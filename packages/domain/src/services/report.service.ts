import mongoose from 'mongoose';
import { AssessmentModel } from '../models/assessment.model';
import { AttendanceModel } from '../models/attendance.model';
import { CourseModel } from '../models/course.model';
import { EnrollmentModel } from '../models/enrollment.model';
import { LessonProgressModel } from '../models/lesson-progress.model';
import { SubmissionModel } from '../models/submission.model';
import { UserModel } from '../models/user.model';
import { ForbiddenError, NotFoundError } from '../errors';
import { hasAnyRole, type AuthContext } from '../rbac/roles';
import { toCourseCard } from './course-serialize';

const { Types } = mongoose;

const isManager = (ctx: AuthContext) => hasAnyRole(ctx.role, ['admin', 'super_admin']);

async function loadCourseForStaff(ctx: AuthContext, courseId: string) {
  if (!Types.ObjectId.isValid(courseId)) throw NotFoundError('Course not found.');
  const course = await CourseModel.findOne({ _id: courseId, institutionId: ctx.institutionId });
  if (!course) throw NotFoundError('Course not found.');
  if (!isManager(ctx) && String(course.instructorId) !== ctx.userId) {
    throw ForbiddenError('You do not manage this course.');
  }
  return course;
}

export async function getCourseReportSummary(ctx: AuthContext, courseId: string) {
  await loadCourseForStaff(ctx, courseId);

  const [enrollmentCount, activeCount, completedCount, pendingGradingCount, graded, attendance] =
    await Promise.all([
      EnrollmentModel.countDocuments({ courseId }),
      EnrollmentModel.countDocuments({ courseId, status: 'active' }),
      EnrollmentModel.countDocuments({ courseId, status: 'completed' }),
      SubmissionModel.countDocuments({ courseId, status: { $in: ['submitted', 'grading'] } }),
      SubmissionModel.find({ courseId, status: { $in: ['graded', 'auto_graded'] } }).select(
        'totalScorePercent',
      ),
      AttendanceModel.aggregate<{ _id: null; total: number; present: number }>([
        { $match: { courseId: new Types.ObjectId(courseId) } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: { $sum: { $cond: ['$present', 1, 0] } },
          },
        },
      ]),
    ]);

  const gradeValues = graded
    .map((submission) => submission.totalScorePercent)
    .filter((value): value is number => typeof value === 'number');
  const averageGradePercent =
    gradeValues.length === 0
      ? 0
      : Math.round((gradeValues.reduce((sum, value) => sum + value, 0) / gradeValues.length) * 100) /
        100;
  const attendanceRow = attendance[0];
  const averageAttendancePercent =
    !attendanceRow || attendanceRow.total === 0
      ? 0
      : Math.round((attendanceRow.present / attendanceRow.total) * 10_000) / 100;

  return {
    courseId,
    enrollmentCount,
    activeCount,
    completedCount,
    averageGradePercent,
    averageAttendancePercent,
    pendingGradingCount,
  };
}

export async function getInstitutionReportSummary(ctx: AuthContext) {
  const [totalUsers, totalCourses, pendingCourseApprovals, activeEnrollments, attendance] = await Promise.all([
    UserModel.countDocuments({ institutionId: ctx.institutionId }),
    CourseModel.countDocuments({ institutionId: ctx.institutionId }),
    CourseModel.countDocuments({ institutionId: ctx.institutionId, status: 'pending_review' }),
    EnrollmentModel.countDocuments({ institutionId: ctx.institutionId, status: 'active' }),
    AttendanceModel.aggregate<{ _id: null; total: number; present: number }>([
      { $match: { institutionId: new Types.ObjectId(ctx.institutionId) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          present: { $sum: { $cond: ['$present', 1, 0] } },
        },
      },
    ]),
  ]);
  const attendanceRow = attendance[0];
  const averagePlatformAttendancePercent =
    !attendanceRow || attendanceRow.total === 0
      ? 0
      : Math.round((attendanceRow.present / attendanceRow.total) * 10_000) / 100;

  return {
    totalUsers,
    totalCourses,
    pendingCourseApprovals,
    activeEnrollments,
    averagePlatformAttendancePercent,
  };
}

export async function getStudentDashboard(ctx: AuthContext) {
  const enrollments = await EnrollmentModel.find({
    institutionId: ctx.institutionId,
    studentId: ctx.userId,
    status: { $in: ['active', 'completed', 'pending_approval'] },
  }).sort({ enrolledAt: -1 });

  const courseIds = enrollments.map((enrollment) => enrollment.courseId);
  const [courses, progressDocs, assessments, submissions] = await Promise.all([
    CourseModel.find({ _id: { $in: courseIds } }),
    LessonProgressModel.find({ studentId: ctx.userId, courseId: { $in: courseIds } }),
    AssessmentModel.find({
      courseId: { $in: courseIds },
      status: 'published',
      dueAt: { $exists: true },
    }).sort({ dueAt: 1 }),
    SubmissionModel.find({
      studentId: ctx.userId,
      courseId: { $in: courseIds },
    }).sort({ gradedAt: -1, submittedAt: -1 }),
  ]);

  const progressByCourse = new Map<string, { completed: number }>();
  for (const progress of progressDocs) {
    const courseId = String(progress.courseId);
    const current = progressByCourse.get(courseId) ?? { completed: 0 };
    if (progress.status === 'completed') current.completed++;
    progressByCourse.set(courseId, current);
  }
  const submissionByAssessment = new Set(submissions.map((submission) => String(submission.assessmentId)));
  const now = new Date();

  return {
    courses: enrollments.map((enrollment) => {
      const course = courses.find((candidate) => String(candidate._id) === String(enrollment.courseId));
      const lessonCount =
        course?.modules?.reduce(
          (sum, module) => sum + (module.lessons?.length ?? 0),
          0,
        ) ?? 0;
      const completed = progressByCourse.get(String(enrollment.courseId))?.completed ?? 0;
      return {
        enrollmentId: String(enrollment._id),
        status: enrollment.status,
        finalGradePercent: enrollment.finalGradePercent ?? null,
        course: course ? toCourseCard(course) : null,
        progressPercent: lessonCount === 0 ? 0 : Math.round((completed / lessonCount) * 100),
      };
    }),
    upcomingDeadlines: assessments
      .filter((assessment) => !submissionByAssessment.has(String(assessment._id)))
      .slice(0, 8)
      .map((assessment) => ({
        id: String(assessment._id),
        courseId: String(assessment.courseId),
        title: assessment.title,
        type: assessment.type,
        dueAt: assessment.dueAt,
        overdue: assessment.dueAt ? assessment.dueAt < now : false,
      })),
    recentGrades: submissions
      .filter((submission) => ['graded', 'auto_graded'].includes(submission.status))
      .slice(0, 6)
      .map((submission) => ({
        id: String(submission._id),
        courseId: String(submission.courseId),
        assessmentId: String(submission.assessmentId),
        totalScore: submission.totalScore ?? null,
        totalScorePercent: submission.totalScorePercent ?? null,
        gradedAt: submission.gradedAt ?? submission.submittedAt,
      })),
  };
}

export async function getInstructorDashboard(ctx: AuthContext) {
  const courses = await CourseModel.find({
    institutionId: ctx.institutionId,
    instructorId: ctx.userId,
    isTemplate: false,
  }).sort({ updatedAt: -1 });

  const summaries = await Promise.all(
    courses.map(async (course) => ({
      course: toCourseCard(course),
      summary: await getCourseReportSummary(ctx, String(course._id)),
    })),
  );

  return {
    totals: {
      courses: courses.length,
      enrollments: summaries.reduce((sum, row) => sum + row.summary.enrollmentCount, 0),
      pendingGrading: summaries.reduce((sum, row) => sum + row.summary.pendingGradingCount, 0),
    },
    courses: summaries,
  };
}

export async function getAdminDashboard(ctx: AuthContext) {
  const [summary, pendingCourses, recentUsers] = await Promise.all([
    getInstitutionReportSummary(ctx),
    CourseModel.find({ institutionId: ctx.institutionId, status: 'pending_review' })
      .sort({ updatedAt: -1 })
      .limit(5),
    UserModel.find({ institutionId: ctx.institutionId }).sort({ createdAt: -1 }).limit(5),
  ]);

  return {
    summary,
    pendingCourses: pendingCourses.map(toCourseCard),
    recentUsers: recentUsers.map((user) => ({
      id: String(user._id),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
    })),
  };
}

export async function exportCourseReportCsv(ctx: AuthContext, courseId: string) {
  const course = await loadCourseForStaff(ctx, courseId);
  const submissions = await SubmissionModel.find({ courseId }).sort({ submittedAt: -1 });
  const lines = [
    ['course', 'submission_id', 'student_id', 'status', 'submitted_at', 'is_late', 'score', 'percent'].join(','),
    ...submissions.map((submission) =>
      [
        csvCell(course.title),
        String(submission._id),
        String(submission.studentId),
        submission.status,
        submission.submittedAt.toISOString(),
        String(submission.isLate),
        submission.totalScore ?? '',
        submission.totalScorePercent ?? '',
      ]
        .map(csvCell)
        .join(','),
    ),
  ];
  return lines.join('\n');
}

function csvCell(value: unknown): string {
  const raw = String(value ?? '');
  return /[",\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}
