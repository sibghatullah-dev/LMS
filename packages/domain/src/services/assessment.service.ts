import mongoose, { type HydratedDocument } from 'mongoose';
import { AssessmentModel, type Assessment } from '../models/assessment.model';
import { CourseModel, type Course } from '../models/course.model';
import { EnrollmentModel } from '../models/enrollment.model';
import { SubmissionModel, type Submission } from '../models/submission.model';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { hasAnyRole, type AuthContext } from '../rbac/roles';
import type {
  BulkGradeInput,
  CreateAssessmentInput,
  CreateSubmissionInput,
  GradeSubmissionInput,
  ListSubmissionsInput,
  UpdateAssessmentInput,
} from '../schemas/assessment.schema';
import { writeAudit } from './audit.service';
import { toPublicAssessment, toPublicSubmission } from './assessment-serialize';
import { notifyUser } from './notification.service';
import { issueCertificateIfEligible } from './certificate.service';

const { Types } = mongoose;
type CourseDoc = HydratedDocument<Course>;
type AssessmentDoc = HydratedDocument<Assessment>;
type SubmissionDoc = HydratedDocument<Submission>;

const isManager = (ctx: AuthContext) => hasAnyRole(ctx.role, ['admin', 'super_admin']);
const isObjective = (type: string) => ['multiple_choice', 'true_false', 'matching'].includes(type);

async function loadCourse(ctx: AuthContext, courseId: string): Promise<CourseDoc> {
  if (!Types.ObjectId.isValid(courseId)) throw NotFoundError('Course not found.');
  const course = await CourseModel.findOne({ _id: courseId, institutionId: ctx.institutionId });
  if (!course) throw NotFoundError('Course not found.');
  return course;
}

function assertCourseStaff(ctx: AuthContext, course: CourseDoc): void {
  if (isManager(ctx)) return;
  if (String(course.instructorId) === ctx.userId) return;
  throw ForbiddenError('You do not manage this course.');
}

async function loadAssessment(ctx: AuthContext, assessmentId: string): Promise<AssessmentDoc> {
  if (!Types.ObjectId.isValid(assessmentId)) throw NotFoundError('Assessment not found.');
  const assessment = await AssessmentModel.findOne({
    _id: assessmentId,
    institutionId: ctx.institutionId,
  });
  if (!assessment) throw NotFoundError('Assessment not found.');
  return assessment;
}

async function loadSubmission(ctx: AuthContext, submissionId: string): Promise<SubmissionDoc> {
  if (!Types.ObjectId.isValid(submissionId)) throw NotFoundError('Submission not found.');
  const submission = await SubmissionModel.findOne({
    _id: submissionId,
    institutionId: ctx.institutionId,
  });
  if (!submission) throw NotFoundError('Submission not found.');
  return submission;
}

async function assertActiveEnrollment(ctx: AuthContext, courseId: string) {
  const enrollment = await EnrollmentModel.findOne({
    courseId,
    studentId: ctx.userId,
    status: { $in: ['active', 'completed'] },
  });
  if (!enrollment) throw ForbiddenError('Enroll in this course before submitting work.');
  return enrollment;
}

function validateAssessmentShape(
  input: CreateAssessmentInput | UpdateAssessmentInput,
  baseType?: string,
  // The assessment's currently persisted maxScore, when editing — required so a
  // PATCH that only touches `rubric` (a normal edit) is still validated against
  // the real ceiling instead of silently skipping the check because `maxScore`
  // wasn't part of this particular request body.
  persistedMaxScore?: number,
) {
  const type = 'type' in input ? input.type : baseType;
  if (type === 'assignment' && input.submissionTypes && input.submissionTypes.length === 0) {
    throw ValidationError('Assignments require at least one submission type.');
  }
  if (type === 'quiz' && input.questions && input.questions.length === 0) {
    throw ValidationError('Quizzes require at least one question.');
  }
  if (input.rubric?.length) {
    const rubricTotal = input.rubric.reduce((sum: number, r) => sum + r.maxPoints, 0);
    const ceiling = input.maxScore ?? persistedMaxScore;
    if (ceiling !== undefined && rubricTotal > ceiling) {
      throw ValidationError('Rubric points cannot exceed the assessment max score.');
    }
  }
}

function applyAssessmentInput(assessment: AssessmentDoc, input: UpdateAssessmentInput) {
  if (input.moduleId !== undefined) assessment.moduleId = new Types.ObjectId(input.moduleId);
  if (input.title !== undefined) assessment.title = input.title;
  if (input.instructions !== undefined) assessment.instructions = input.instructions;
  if (input.dueAt !== undefined) assessment.dueAt = input.dueAt;
  if (input.allowLateSubmission !== undefined) assessment.allowLateSubmission = input.allowLateSubmission;
  if (input.latePenaltyPercentPerDay !== undefined)
    assessment.latePenaltyPercentPerDay = input.latePenaltyPercentPerDay;
  if (input.maxScore !== undefined) assessment.maxScore = input.maxScore;
  if (input.weightPercent !== undefined) assessment.weightPercent = input.weightPercent;
  if (input.submissionTypes !== undefined) assessment.submissionTypes = input.submissionTypes;
  if (input.rubric !== undefined) assessment.set('rubric', input.rubric);
  if (input.questions !== undefined) assessment.set('questions', input.questions);
  if (input.status !== undefined) assessment.status = input.status;
}

export async function listAssessments(ctx: AuthContext, courseId: string) {
  const course = await loadCourse(ctx, courseId);
  const canManage = isManager(ctx) || String(course.instructorId) === ctx.userId;
  const filter: Record<string, unknown> = { institutionId: ctx.institutionId, courseId };
  if (!canManage) {
    if (course.status !== 'published') throw ForbiddenError('This course is not available.');
    await assertActiveEnrollment(ctx, courseId);
    filter.status = 'published';
  }
  const assessments = await AssessmentModel.find(filter).sort({ dueAt: 1, createdAt: 1 });
  return assessments.map(toPublicAssessment);
}

export async function createAssessment(
  ctx: AuthContext,
  courseId: string,
  input: CreateAssessmentInput,
) {
  const course = await loadCourse(ctx, courseId);
  assertCourseStaff(ctx, course);
  validateAssessmentShape(input);

  const assessment = await AssessmentModel.create({
    ...input,
    institutionId: ctx.institutionId,
    courseId,
    moduleId: input.moduleId ? new Types.ObjectId(input.moduleId) : undefined,
    createdBy: ctx.userId,
    instructions: input.instructions ?? '',
  });
  return toPublicAssessment(assessment);
}

export async function getAssessment(ctx: AuthContext, assessmentId: string) {
  const assessment = await loadAssessment(ctx, assessmentId);
  const course = await loadCourse(ctx, String(assessment.courseId));
  if (assessment.status !== 'published') assertCourseStaff(ctx, course);
  if (assessment.status === 'published' && String(course.instructorId) !== ctx.userId && !isManager(ctx)) {
    await assertActiveEnrollment(ctx, String(course._id));
  }
  return toPublicAssessment(assessment);
}

export async function updateAssessment(
  ctx: AuthContext,
  assessmentId: string,
  input: UpdateAssessmentInput,
) {
  const assessment = await loadAssessment(ctx, assessmentId);
  const course = await loadCourse(ctx, String(assessment.courseId));
  assertCourseStaff(ctx, course);
  validateAssessmentShape(input, assessment.type, assessment.maxScore);

  const hasSubmissions = await SubmissionModel.exists({ assessmentId: assessment._id });
  if (hasSubmissions) {
    assessment.status = 'closed';
    await assessment.save();
    const clone = new AssessmentModel({
      institutionId: assessment.institutionId,
      courseId: assessment.courseId,
      moduleId: assessment.moduleId,
      createdBy: ctx.userId,
      type: assessment.type,
      title: assessment.title,
      instructions: assessment.instructions,
      dueAt: assessment.dueAt,
      allowLateSubmission: assessment.allowLateSubmission,
      latePenaltyPercentPerDay: assessment.latePenaltyPercentPerDay,
      maxScore: assessment.maxScore,
      weightPercent: assessment.weightPercent,
      submissionTypes: assessment.submissionTypes,
      rubric: assessment.rubric,
      questions: assessment.questions,
      status: input.status ?? 'draft',
      revisionOf: assessment._id,
    });
    applyAssessmentInput(clone, input);
    await clone.save();
    return toPublicAssessment(clone);
  }

  applyAssessmentInput(assessment, input);
  await assessment.save();
  return toPublicAssessment(assessment);
}

function normalizeAnswer(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).sort().join('|');
  return String(value ?? '').trim();
}

function applyLatePenalty(score: number, assessment: AssessmentDoc, submittedAt: Date): number {
  if (!assessment.dueAt || submittedAt <= assessment.dueAt) return score;
  const penalty = assessment.latePenaltyPercentPerDay ?? 0;
  if (penalty <= 0) return score;
  const lateMs = submittedAt.getTime() - assessment.dueAt.getTime();
  const daysLate = Math.max(1, Math.ceil(lateMs / 86_400_000));
  const multiplier = Math.max(0, 1 - (penalty * daysLate) / 100);
  return Math.round(score * multiplier * 100) / 100;
}

export async function submitAssessment(
  ctx: AuthContext,
  assessmentId: string,
  input: CreateSubmissionInput,
) {
  const assessment = await loadAssessment(ctx, assessmentId);
  if (assessment.status !== 'published') throw ValidationError('This assessment is not open.');
  await assertActiveEnrollment(ctx, String(assessment.courseId));

  const submittedAt = new Date();
  const isLate = Boolean(assessment.dueAt && submittedAt > assessment.dueAt);
  if (isLate && !assessment.allowLateSubmission) {
    throw ConflictError('Submission window closed and late submission is not allowed.');
  }

  const existing = await SubmissionModel.exists({ assessmentId: assessment._id, studentId: ctx.userId });
  if (existing) throw ConflictError('You have already submitted this assessment.');

  let status: Submission['status'] = 'submitted';
  let totalScore: number | undefined;
  let totalScorePercent: number | undefined;
  const inputAnswers = input.answers ?? [];
  const inputFileUploads = input.fileUploads ?? [];
  const inputFileStorageKeys = input.fileStorageKeys ?? [];

  const answers = inputAnswers.map((answer) => {
    const question = assessment.questions.find((q) => String(q._id) === answer.questionId);
    if (!question) throw ValidationError('Answer references an unknown question.');
    if (!isObjective(question.questionType)) {
      status = 'grading';
      return {
        questionId: new Types.ObjectId(answer.questionId),
        response: answer.response,
        pointsAwarded: 0,
      };
    }
    const correct = normalizeAnswer(answer.response) === normalizeAnswer(question.correctAnswer);
    return {
      questionId: new Types.ObjectId(answer.questionId),
      response: answer.response,
      autoGradedCorrect: correct,
      pointsAwarded: correct ? question.points : 0,
    };
  });

  if (assessment.type === 'quiz' && answers.length === assessment.questions.length) {
    const hasEssay = assessment.questions.some((q) => q.questionType === 'essay');
    const rawScore = answers.reduce((sum, a) => sum + (a.pointsAwarded ?? 0), 0);
    if (!hasEssay) {
      totalScore = applyLatePenalty(rawScore, assessment, submittedAt);
      totalScorePercent = assessment.maxScore === 0 ? 0 : Math.round((totalScore / assessment.maxScore) * 10000) / 100;
      status = 'auto_graded';
    }
  }

  if (assessment.type === 'assignment') {
    const needsText = assessment.submissionTypes.includes('text');
    const needsFile = assessment.submissionTypes.includes('file');
    if (needsText && !input.textResponse) throw ValidationError('Text response is required.');
    if (needsFile && inputFileUploads.length === 0 && inputFileStorageKeys.length === 0) {
      throw ValidationError('At least one file upload is required.');
    }
    status = 'grading';
  }

  const fileUploads =
    inputFileUploads.length > 0
      ? inputFileUploads
      : inputFileStorageKeys.map((storageKey) => ({
          storageKey,
          fileName: storageKey.split('/').pop() ?? 'uploaded-file',
          mimeType: 'application/octet-stream',
          sizeBytes: 0,
        }));

  const submission = await SubmissionModel.create({
    institutionId: ctx.institutionId,
    assessmentId: assessment._id,
    studentId: ctx.userId,
    courseId: assessment.courseId,
    submittedAt,
    isLate,
    answers,
    fileUploads,
    textResponse: input.textResponse,
    status,
    totalScore,
    totalScorePercent,
  });
  if (status === 'grading') {
    const course = await CourseModel.findById(assessment.courseId).select('instructorId title');
    if (course) {
      await notifyUser({
        institutionId: ctx.institutionId,
        userId: course.instructorId,
        type: 'submission_received',
        title: 'Submission ready for grading',
        body: `${assessment.title} has a new submission.`,
        actionUrl: `/instructor/assessments/${String(assessment._id)}/submissions`,
        relatedEntity: { type: 'submission', id: submission._id },
      });
    }
  }
  if (status === 'auto_graded') {
    // A course whose grade is composed entirely of auto-graded quizzes must still
    // trigger completion/certificate issuance — this was previously only wired on
    // the manual-grading path, so quiz-only courses never completed a student.
    await recomputeFinalGrade(ctx.userId, String(assessment.courseId));
  }
  return toPublicSubmission(submission);
}

function scorePercent(score: number, maxScore: number): number {
  return maxScore === 0 ? 0 : Math.round((score / maxScore) * 10000) / 100;
}

/**
 * Recompute the student's running grade for a course and, only once every
 * currently weighted assessment has been graded, treat it as "final" and
 * evaluate certificate eligibility.
 *
 * BUGFIX: this previously normalized the weighted average by the weight of
 * assessments graded *so far* (`weighted / weights`) rather than by the
 * course's total weighted assessment count. That let a student who aced a
 * single 20%-weight quiz get a computed "100% final grade" — and an
 * auto-issued completion certificate — before doing the other 80% of the
 * coursework. The average is still useful as a running "current standing"
 * (FR-ASSESS-10), so it's always written to the enrollment; certificate
 * issuance is now gated separately on full completion.
 */
async function recomputeFinalGrade(studentId: string, courseId: string) {
  // Both manually-graded (rubric/weighted) AND auto-graded (objective quiz)
  // submissions count toward the grade — excluding auto_graded here would
  // silently drop every objective-quiz score from the weighted average.
  const [graded, weightedAssessments] = await Promise.all([
    SubmissionModel.find({ studentId, courseId, status: { $in: ['graded', 'auto_graded'] } }),
    // "closed" assessments are prior revisions still referenced by historical
    // submissions (DDD §5) — they must still count toward completion.
    AssessmentModel.find({
      courseId,
      status: { $in: ['published', 'closed'] },
      weightPercent: { $gt: 0 },
    }).select('_id weightPercent'),
  ]);

  const weightById = new Map(weightedAssessments.map((a) => [String(a._id), a.weightPercent ?? 0]));
  const gradedAssessmentIds = new Set<string>();
  let weighted = 0;
  let weights = 0;
  for (const submission of graded) {
    if (submission.totalScorePercent == null) continue;
    const assessmentId = String(submission.assessmentId);
    const weight = weightById.get(assessmentId) ?? 0;
    if (weight <= 0) continue;
    weighted += submission.totalScorePercent * weight;
    weights += weight;
    gradedAssessmentIds.add(assessmentId);
  }
  const finalGradePercent = weights === 0 ? undefined : Math.round((weighted / weights) * 100) / 100;
  if (finalGradePercent === undefined) return undefined;

  await EnrollmentModel.updateOne(
    { studentId, courseId, status: { $in: ['active', 'completed'] } },
    { $set: { finalGradePercent } },
  );

  // Every weighted assessment currently defined for the course must have a
  // graded submission from this student before the grade counts as "final."
  const allWeightedAssessmentsGraded = weightedAssessments.every((a) =>
    gradedAssessmentIds.has(String(a._id)),
  );
  if (allWeightedAssessmentsGraded) {
    await issueCertificateIfEligible(studentId, courseId);
  }
  return finalGradePercent;
}

export async function listSubmissions(
  ctx: AuthContext,
  assessmentId: string,
  input: ListSubmissionsInput,
) {
  const assessment = await loadAssessment(ctx, assessmentId);
  const course = await loadCourse(ctx, String(assessment.courseId));
  assertCourseStaff(ctx, course);
  const filter: Record<string, unknown> = { assessmentId: assessment._id };
  if (input.status) filter.status = input.status;
  const submissions = await SubmissionModel.find(filter).sort({ submittedAt: -1 });
  return submissions.map(toPublicSubmission);
}

export async function getSubmission(ctx: AuthContext, submissionId: string) {
  const submission = await loadSubmission(ctx, submissionId);
  if (String(submission.studentId) === ctx.userId) return toPublicSubmission(submission);
  const course = await loadCourse(ctx, String(submission.courseId));
  assertCourseStaff(ctx, course);
  return toPublicSubmission(submission);
}

/** FR-ASSESS-10 — a student's grade/submission history for one course. */
export async function getMyCourseGrades(ctx: AuthContext, courseId: string) {
  const course = await loadCourse(ctx, courseId);
  await assertActiveEnrollment(ctx, String(course._id));

  const [assessments, submissions, enrollment] = await Promise.all([
    AssessmentModel.find({
      institutionId: ctx.institutionId,
      courseId,
      status: { $in: ['published', 'closed'] },
    }).sort({ dueAt: 1, createdAt: 1 }),
    SubmissionModel.find({
      institutionId: ctx.institutionId,
      courseId,
      studentId: ctx.userId,
    }),
    EnrollmentModel.findOne({ courseId, studentId: ctx.userId }),
  ]);

  const submissionByAssessment = new Map(
    submissions.map((submission) => [String(submission.assessmentId), submission]),
  );

  return {
    course: { id: String(course._id), title: course.title },
    finalGradePercent: enrollment?.finalGradePercent ?? null,
    assessments: assessments.map((assessment) => ({
      ...toPublicAssessment(assessment),
      submission: submissionByAssessment.has(String(assessment._id))
        ? toPublicSubmission(submissionByAssessment.get(String(assessment._id))!)
        : null,
    })),
  };
}

export async function gradeSubmission(
  ctx: AuthContext,
  submissionId: string,
  input: GradeSubmissionInput,
) {
  const submission = await loadSubmission(ctx, submissionId);
  const assessment = await loadAssessment(ctx, String(submission.assessmentId));
  const course = await loadCourse(ctx, String(submission.courseId));
  assertCourseStaff(ctx, course);
  if (String(submission.studentId) === ctx.userId) {
    throw ForbiddenError('You cannot grade your own submission.');
  }

  const before = {
    status: submission.status,
    totalScore: submission.totalScore,
    totalScorePercent: submission.totalScorePercent,
  };

  let totalScore = input.totalScore;
  if (input.rubricScores?.length) {
    const maxByCriterion = new Map(assessment.rubric.map((r) => [r.criterion, r.maxPoints]));
    totalScore = input.rubricScores.reduce((sum, score) => {
      const max = maxByCriterion.get(score.criterion);
      if (max == null) throw ValidationError(`Unknown rubric criterion "${score.criterion}".`);
      if (score.pointsAwarded > max) {
        throw ValidationError(`Rubric score for "${score.criterion}" exceeds max points.`);
      }
      return sum + score.pointsAwarded;
    }, 0);
    submission.set('rubricScores', input.rubricScores);
  }
  if (totalScore === undefined) throw ValidationError('Provide totalScore or rubricScores.');
  if (totalScore > assessment.maxScore) throw ValidationError('Score cannot exceed max score.');

  const penalizedScore = applyLatePenalty(totalScore, assessment, submission.submittedAt);
  submission.totalScore = penalizedScore;
  submission.totalScorePercent = scorePercent(penalizedScore, assessment.maxScore);
  submission.instructorComment = input.instructorComment;
  submission.status = 'graded';
  submission.gradedBy = new Types.ObjectId(ctx.userId);
  submission.gradedAt = new Date();
  await submission.save();
  const finalGradePercent = await recomputeFinalGrade(String(submission.studentId), String(submission.courseId));

  await writeAudit({
    institutionId: ctx.institutionId,
    actorId: ctx.userId,
    actorRole: ctx.role,
    action: 'submission.grade',
    targetEntity: { type: 'submission', id: submission._id },
    before,
    after: {
      status: submission.status,
      totalScore: submission.totalScore,
      totalScorePercent: submission.totalScorePercent,
      finalGradePercent,
    },
  });

  await notifyUser({
    institutionId: ctx.institutionId,
    userId: submission.studentId,
    type: 'grade_posted',
    title: 'Grade posted',
    body: `${assessment.title}: ${submission.totalScorePercent}%`,
    actionUrl: `/grades/${String(submission.courseId)}`,
    relatedEntity: { type: 'submission', id: submission._id },
  });

  return toPublicSubmission(submission);
}

/**
 * FR-ASSESS-07 — apply one score/comment to many submissions at once.
 *
 * Each submissionId is verified to actually belong to `assessmentId` before
 * grading — without this, a bulk-grade call scoped to one assessment could
 * silently apply an unrelated score to a submission under a different
 * assessment (with a different maxScore) elsewhere in the institution.
 *
 * Failures are collected per-item rather than aborting the whole batch: with a
 * sequential "throw on first error" loop, submissions already graded before
 * the failure stay graded with no way for the caller to know which succeeded.
 */
export async function bulkGradeSubmissions(
  ctx: AuthContext,
  assessmentId: string,
  input: BulkGradeInput,
) {
  const assessment = await loadAssessment(ctx, assessmentId);
  const course = await loadCourse(ctx, String(assessment.courseId));
  assertCourseStaff(ctx, course);

  const graded: Awaited<ReturnType<typeof gradeSubmission>>[] = [];
  const failed: { submissionId: string; reason: string }[] = [];

  for (const submissionId of input.submissionIds) {
    try {
      const submission = await SubmissionModel.findOne({
        _id: submissionId,
        institutionId: ctx.institutionId,
      }).select('assessmentId');
      if (!submission || String(submission.assessmentId) !== String(assessment._id)) {
        failed.push({ submissionId, reason: 'Does not belong to this assessment.' });
        continue;
      }
      const result = await gradeSubmission(ctx, submissionId, {
        totalScore: input.totalScore,
        instructorComment: input.instructorComment,
      });
      graded.push(result);
    } catch (err) {
      failed.push({ submissionId, reason: err instanceof Error ? err.message : 'Grading failed.' });
    }
  }
  return { graded, failed };
}
