import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AssessmentModel } from '../src/models/assessment.model';
import { CourseModel } from '../src/models/course.model';
import { EnrollmentModel } from '../src/models/enrollment.model';
import { InstitutionModel } from '../src/models/institution.model';
import { SubmissionModel } from '../src/models/submission.model';
import { UserModel } from '../src/models/user.model';
import type { AuthContext } from '../src/rbac/roles';
import { createAssessment, gradeSubmission, submitAssessment } from '../src/services/assessment.service';
import { createCourse } from '../src/services/course.service';
import {
  getAdminDashboard,
  getCourseReportSummary,
  getInstructorDashboard,
  getStudentDashboard,
} from '../src/services/report.service';

async function makeInstitution(slug: string) {
  const inst = await InstitutionModel.create({ name: slug, slug });
  return String(inst._id);
}

async function makeUser(institutionId: string, role: AuthContext['role']): Promise<AuthContext> {
  const u = await UserModel.create({
    institutionId,
    email: `${role}-${Math.floor(performance.now() * 1000)}@x.com`,
    fullName: role,
    role,
    status: 'active',
  });
  return { userId: String(u._id), institutionId, role };
}

let institutionId: string;
let instructor: AuthContext;
let student: AuthContext;
let admin: AuthContext;
let courseId: string;

beforeAll(async () => {
  await Promise.all([CourseModel.createIndexes(), AssessmentModel.createIndexes(), SubmissionModel.createIndexes()]);
});

beforeEach(async () => {
  institutionId = await makeInstitution('lumora-reports');
  instructor = await makeUser(institutionId, 'instructor');
  student = await makeUser(institutionId, 'student');
  admin = await makeUser(institutionId, 'admin');
  const course = await createCourse(instructor, {
    title: 'Reportable Course',
    language: 'en',
    enrollmentMode: 'open',
  });
  courseId = course.id;
  await CourseModel.updateOne({ _id: courseId }, { $set: { status: 'published' } });
  await EnrollmentModel.create({
    institutionId,
    courseId,
    studentId: student.userId,
    status: 'active',
    enrolledAt: new Date(),
  });
});

describe('Phase 6 report summaries', () => {
  it('summarizes course enrollment, average grade, and pending grading', async () => {
    const assignment = await createAssessment(instructor, courseId, {
      type: 'assignment',
      title: 'Essay',
      maxScore: 100,
      weightPercent: 50,
      status: 'published',
      submissionTypes: ['text'],
    });
    const submission = await submitAssessment(student, assignment.id, { textResponse: 'Ready' });
    let summary = await getCourseReportSummary(instructor, courseId);
    expect(summary.enrollmentCount).toBe(1);
    expect(summary.activeCount).toBe(1);
    expect(summary.pendingGradingCount).toBe(1);

    await gradeSubmission(instructor, submission.id, { totalScore: 88, instructorComment: 'Solid.' });
    summary = await getCourseReportSummary(instructor, courseId);
    expect(summary.pendingGradingCount).toBe(0);
    expect(summary.averageGradePercent).toBe(88);
  });

  it('builds student, instructor, and admin dashboard aggregates', async () => {
    await createAssessment(instructor, courseId, {
      type: 'assignment',
      title: 'Upcoming',
      maxScore: 10,
      weightPercent: 10,
      status: 'published',
      submissionTypes: ['text'],
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const studentDash = await getStudentDashboard(student);
    expect(studentDash.courses).toHaveLength(1);
    expect(studentDash.upcomingDeadlines.map((d) => d.title)).toContain('Upcoming');

    const instructorDash = await getInstructorDashboard(instructor);
    expect(instructorDash.totals.courses).toBe(1);
    expect(instructorDash.totals.enrollments).toBe(1);

    await CourseModel.updateOne({ _id: courseId }, { $set: { status: 'pending_review' } });
    const adminDash = await getAdminDashboard(admin);
    expect(adminDash.summary.totalUsers).toBe(3);
    expect(adminDash.summary.pendingCourseApprovals).toBe(1);
    expect(adminDash.pendingCourses.map((course) => course.id)).toContain(courseId);
  });
});
