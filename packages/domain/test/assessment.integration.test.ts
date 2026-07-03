import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuditLogModel } from '../src/models/audit-log.model';
import { AssessmentModel } from '../src/models/assessment.model';
import { CertificateModel } from '../src/models/certificate.model';
import { CourseModel } from '../src/models/course.model';
import { EnrollmentModel } from '../src/models/enrollment.model';
import { InstitutionModel } from '../src/models/institution.model';
import { SubmissionModel } from '../src/models/submission.model';
import { UserModel } from '../src/models/user.model';
import type { AuthContext } from '../src/rbac/roles';
import {
  bulkGradeSubmissions,
  createAssessment,
  gradeSubmission,
  submitAssessment,
  updateAssessment,
} from '../src/services/assessment.service';
import { createCourse } from '../src/services/course.service';
import { createAssessmentSchema } from '../src/schemas/assessment.schema';

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

async function activeEnrollment(student: AuthContext, courseId: string) {
  return EnrollmentModel.create({
    institutionId: student.institutionId,
    courseId,
    studentId: student.userId,
    status: 'active',
    enrolledAt: new Date(),
  });
}

let institutionId: string;
let instructor: AuthContext;
let student: AuthContext;
let courseId: string;

beforeAll(async () => {
  await Promise.all([CourseModel.createIndexes(), AssessmentModel.createIndexes(), SubmissionModel.createIndexes()]);
});

beforeEach(async () => {
  institutionId = await makeInstitution('lumora-assess');
  instructor = await makeUser(institutionId, 'instructor');
  student = await makeUser(institutionId, 'student');
  const course = await createCourse(instructor, {
    title: 'Assessment Course',
    language: 'en',
    enrollmentMode: 'open',
  });
  courseId = course.id;
  await CourseModel.updateOne({ _id: courseId }, { $set: { status: 'published' } });
  await activeEnrollment(student, courseId);
});

describe('assessment creation and objective grading (FR-ASSESS-01..04)', () => {
  it('auto-grades objective quiz answers immediately', async () => {
    const quiz = await createAssessment(instructor, courseId, {
      type: 'quiz',
      title: 'Quiz 1',
      maxScore: 10,
      weightPercent: 40,
      status: 'published',
      questions: [
        {
          questionType: 'multiple_choice',
          prompt: 'Choose A',
          options: ['A', 'B'],
          correctAnswer: 'A',
          points: 6,
        },
        {
          questionType: 'true_false',
          prompt: 'Sky blue?',
          options: ['true', 'false'],
          correctAnswer: 'true',
          points: 4,
        },
      ],
    });
    const saved = await AssessmentModel.findById(quiz.id);
    const q1 = String(saved!.questions[0]!._id);
    const q2 = String(saved!.questions[1]!._id);

    const submission = await submitAssessment(student, quiz.id, {
      answers: [
        { questionId: q1, response: 'A' },
        { questionId: q2, response: 'false' },
      ],
    });

    expect(submission.status).toBe('auto_graded');
    expect(submission.totalScore).toBe(6);
    expect(submission.totalScorePercent).toBe(60);
    expect(submission.answers[0]!.autoGradedCorrect).toBe(true);
    expect(submission.answers[1]!.autoGradedCorrect).toBe(false);
  });

  it('routes essay quizzes to the manual grading queue', async () => {
    const quiz = await createAssessment(instructor, courseId, {
      type: 'quiz',
      title: 'Essay Quiz',
      maxScore: 10,
      status: 'published',
      questions: [{ questionType: 'essay', prompt: 'Explain.', points: 10 }],
    });
    const saved = await AssessmentModel.findById(quiz.id);
    const submission = await submitAssessment(student, quiz.id, {
      answers: [{ questionId: String(saved!.questions[0]!._id), response: 'Because...' }],
    });
    expect(submission.status).toBe('grading');
    expect(submission.totalScore).toBeNull();
  });

  it('prevents duplicate submissions', async () => {
    const assignment = await createAssessment(instructor, courseId, {
      type: 'assignment',
      title: 'Reflection',
      maxScore: 5,
      status: 'published',
      submissionTypes: ['text'],
    });
    await submitAssessment(student, assignment.id, { textResponse: 'first' });
    await expect(submitAssessment(student, assignment.id, { textResponse: 'second' })).rejects.toMatchObject({
      httpStatus: 409,
    });
  });
});

describe('manual grading, late penalties, and grade rollup (FR-ASSESS-05/06/09/10)', () => {
  it('caps rubric scores, applies late penalty, writes audit, and updates final grade', async () => {
    const assignment = await createAssessment(instructor, courseId, {
      type: 'assignment',
      title: 'Late Essay',
      maxScore: 100,
      weightPercent: 50,
      status: 'published',
      submissionTypes: ['text'],
      dueAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
      allowLateSubmission: true,
      latePenaltyPercentPerDay: 10,
      rubric: [
        { criterion: 'Depth', maxPoints: 70 },
        { criterion: 'Clarity', maxPoints: 30 },
      ],
    });

    const submission = await submitAssessment(student, assignment.id, { textResponse: 'Submitted late.' });
    expect(submission.isLate).toBe(true);

    await expect(
      gradeSubmission(instructor, submission.id, {
        rubricScores: [{ criterion: 'Depth', pointsAwarded: 71 }],
      }),
    ).rejects.toMatchObject({ httpStatus: 400 });

    const graded = await gradeSubmission(instructor, submission.id, {
      rubricScores: [
        { criterion: 'Depth', pointsAwarded: 70 },
        { criterion: 'Clarity', pointsAwarded: 20 },
      ],
      instructorComment: 'Good work.',
    });

    expect(graded.status).toBe('graded');
    expect(graded.totalScore).toBe(72);
    expect(graded.totalScorePercent).toBe(72);

    const enrollment = await EnrollmentModel.findOne({ studentId: student.userId, courseId });
    expect(enrollment!.finalGradePercent).toBe(72);

    const audit = await AuditLogModel.findOne({ action: 'submission.grade', 'targetEntity.id': graded.id });
    expect(audit).toBeTruthy();
  });

  it('rejects late submissions when late submission is disabled', async () => {
    const assignment = await createAssessment(instructor, courseId, {
      type: 'assignment',
      title: 'Closed Essay',
      maxScore: 10,
      status: 'published',
      submissionTypes: ['text'],
      dueAt: new Date(Date.now() - 60 * 1000),
      allowLateSubmission: false,
    });
    await expect(submitAssessment(student, assignment.id, { textResponse: 'late' })).rejects.toMatchObject({
      httpStatus: 409,
    });
  });
});

describe('assessment revision safety (DDD §5)', () => {
  it('closes the original and creates a new revision when editing after submissions exist', async () => {
    const assignment = await createAssessment(instructor, courseId, {
      type: 'assignment',
      title: 'Versioned',
      maxScore: 10,
      status: 'published',
      submissionTypes: ['text'],
    });
    await submitAssessment(student, assignment.id, { textResponse: 'done' });

    const revised = await updateAssessment(instructor, assignment.id, {
      title: 'Versioned v2',
      maxScore: 20,
    });

    expect(revised.id).not.toBe(assignment.id);
    expect(revised.revisionOf).toBe(assignment.id);
    expect(revised.title).toBe('Versioned v2');

    const original = await AssessmentModel.findById(assignment.id);
    expect(original!.status).toBe('closed');
  });
});

describe('regression: weighted grade includes auto-graded quizzes', () => {
  it('combines an auto-graded quiz with a manually-graded assignment in the weighted average', async () => {
    // Bug: recomputeFinalGrade previously only queried status:'graded', silently
    // excluding every auto_graded (objective quiz) submission from the average.
    const quiz = await createAssessment(instructor, courseId, {
      type: 'quiz',
      title: 'Weighted Quiz',
      maxScore: 10,
      weightPercent: 50,
      status: 'published',
      questions: [{ questionType: 'multiple_choice', prompt: 'Q', options: ['A', 'B'], correctAnswer: 'A', points: 10 }],
    });
    const savedQuiz = await AssessmentModel.findById(quiz.id);
    await submitAssessment(student, quiz.id, {
      answers: [{ questionId: String(savedQuiz!.questions[0]!._id), response: 'A' }], // 100%
    });

    const assignment = await createAssessment(instructor, courseId, {
      type: 'assignment',
      title: 'Weighted Assignment',
      maxScore: 100,
      weightPercent: 50,
      status: 'published',
      submissionTypes: ['text'],
    });
    const submission = await submitAssessment(student, assignment.id, { textResponse: 'work' });
    await gradeSubmission(instructor, submission.id, { totalScore: 50 }); // 50%

    // Weighted average: (100*50 + 50*50) / 100 = 75, not just the last-graded 50.
    const enrollment = await EnrollmentModel.findOne({ studentId: student.userId, courseId });
    expect(enrollment!.finalGradePercent).toBe(75);
  });
});

describe('regression: certificates are not issued until all weighted assessments are graded', () => {
  it('does not certify after only one of two weighted assessments is graded', async () => {
    await CourseModel.updateOne(
      { _id: courseId },
      { $set: { completionCriteria: { minGradePercent: 50, minAttendancePercent: 0 } } },
    );

    // Realistic ordering: the instructor sets up the full assessment plan (both
    // weighted pieces) before any student submits — so at grading time, both
    // are already known/weighted.
    const quiz = await createAssessment(instructor, courseId, {
      type: 'quiz',
      title: 'First of two',
      maxScore: 10,
      weightPercent: 20,
      status: 'published',
      questions: [{ questionType: 'multiple_choice', prompt: 'Q', options: ['A', 'B'], correctAnswer: 'A', points: 10 }],
    });
    // A second, still-ungraded assessment worth the remaining 80% of the grade.
    await createAssessment(instructor, courseId, {
      type: 'assignment',
      title: 'Second of two',
      maxScore: 100,
      weightPercent: 80,
      status: 'published',
      submissionTypes: ['text'],
    });

    const savedQuiz = await AssessmentModel.findById(quiz.id);
    await submitAssessment(student, quiz.id, {
      answers: [{ questionId: String(savedQuiz!.questions[0]!._id), response: 'A' }],
    });

    // Bug: this would previously compute finalGradePercent=100 (normalized only
    // over the one graded quiz) and immediately issue a certificate.
    const enrollment = await EnrollmentModel.findOne({ studentId: student.userId, courseId });
    expect(enrollment!.status).not.toBe('completed');
    const certificate = await CertificateModel.findOne({ studentId: student.userId, courseId });
    expect(certificate).toBeNull();
  });

  it('certifies once every weighted assessment has a graded submission', async () => {
    await CourseModel.updateOne(
      { _id: courseId },
      { $set: { completionCriteria: { minGradePercent: 50, minAttendancePercent: 0 } } },
    );

    const quiz = await createAssessment(instructor, courseId, {
      type: 'quiz',
      title: 'Quiz',
      maxScore: 10,
      weightPercent: 50,
      status: 'published',
      questions: [{ questionType: 'multiple_choice', prompt: 'Q', options: ['A', 'B'], correctAnswer: 'A', points: 10 }],
    });
    const savedQuiz = await AssessmentModel.findById(quiz.id);
    await submitAssessment(student, quiz.id, {
      answers: [{ questionId: String(savedQuiz!.questions[0]!._id), response: 'A' }],
    });

    const assignment = await createAssessment(instructor, courseId, {
      type: 'assignment',
      title: 'Assignment',
      maxScore: 100,
      weightPercent: 50,
      status: 'published',
      submissionTypes: ['text'],
    });
    const submission = await submitAssessment(student, assignment.id, { textResponse: 'work' });
    await gradeSubmission(instructor, submission.id, { totalScore: 80 });

    const enrollment = await EnrollmentModel.findOne({ studentId: student.userId, courseId });
    expect(enrollment!.status).toBe('completed');
    const certificate = await CertificateModel.findOne({ studentId: student.userId, courseId });
    expect(certificate).toBeTruthy();
  });
});

describe('regression: grading integrity guards', () => {
  it('forbids an instructor from grading their own submission', async () => {
    const assignment = await createAssessment(instructor, courseId, {
      type: 'assignment',
      title: 'Self Grade Test',
      maxScore: 10,
      status: 'published',
      submissionTypes: ['text'],
    });
    // The instructor is also enrolled (e.g. dual-role/self-test account).
    await activeEnrollment(instructor, courseId);
    const submission = await submitAssessment(instructor, assignment.id, { textResponse: 'mine' });
    await expect(gradeSubmission(instructor, submission.id, { totalScore: 10 })).rejects.toMatchObject({
      httpStatus: 403,
    });
  });

  it('requires a correctAnswer for objective question types (validated at the API boundary)', () => {
    // createAssessment's `input` type presumes Zod has already validated the
    // body (the route wrapper does this); this test exercises that Zod schema
    // directly, since a missing correctAnswer would otherwise silently grade
    // every student's answer wrong with no error anywhere.
    const result = createAssessmentSchema.safeParse({
      type: 'quiz',
      title: 'Bad Quiz',
      maxScore: 10,
      status: 'published',
      questions: [{ questionType: 'multiple_choice', prompt: 'Q', options: ['A', 'B'], points: 10 }],
    });
    expect(result.success).toBe(false);
  });

  it('bulk-grade rejects a submission id that belongs to a different assessment', async () => {
    const assignmentA = await createAssessment(instructor, courseId, {
      type: 'assignment',
      title: 'A',
      maxScore: 10,
      status: 'published',
      submissionTypes: ['text'],
    });
    const assignmentB = await createAssessment(instructor, courseId, {
      type: 'assignment',
      title: 'B',
      maxScore: 10,
      status: 'published',
      submissionTypes: ['text'],
    });
    const subA = await submitAssessment(student, assignmentA.id, { textResponse: 'a' });
    const otherStudent = await makeUser(institutionId, 'student');
    await activeEnrollment(otherStudent, courseId);
    const subB = await submitAssessment(otherStudent, assignmentB.id, { textResponse: 'b' });

    // Bulk-grade scoped to assignmentA's URL but given a submission from assignmentB.
    const result = await bulkGradeSubmissions(instructor, assignmentA.id, {
      submissionIds: [subA.id, subB.id],
      totalScore: 5,
    });
    expect(result.graded).toHaveLength(1);
    expect(result.graded[0]!.id).toBe(subA.id);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]!.submissionId).toBe(subB.id);

    // The mismatched submission must remain ungraded.
    const untouchedB = await SubmissionModel.findById(subB.id);
    expect(untouchedB!.status).toBe('grading');
  });
});
