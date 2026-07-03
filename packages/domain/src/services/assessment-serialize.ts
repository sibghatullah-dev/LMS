import type { HydratedDocument } from 'mongoose';
import type { Assessment } from '../models/assessment.model';
import type { Submission } from '../models/submission.model';

function idOf(value: unknown): string | undefined {
  if (!value) return undefined;
  return String(value);
}

export function toPublicAssessment(doc: HydratedDocument<Assessment>) {
  return {
    id: String(doc._id),
    courseId: String(doc.courseId),
    moduleId: idOf(doc.moduleId),
    type: doc.type,
    title: doc.title,
    instructions: doc.instructions ?? '',
    dueAt: doc.dueAt ?? undefined,
    allowLateSubmission: doc.allowLateSubmission,
    latePenaltyPercentPerDay: doc.latePenaltyPercentPerDay ?? undefined,
    maxScore: doc.maxScore,
    weightPercent: doc.weightPercent,
    submissionTypes: doc.submissionTypes ?? [],
    rubric: doc.rubric ?? [],
    questions: doc.questions ?? [],
    status: doc.status,
    revisionOf: idOf(doc.revisionOf),
  };
}

export function toPublicSubmission(doc: HydratedDocument<Submission>) {
  return {
    id: String(doc._id),
    assessmentId: String(doc.assessmentId),
    courseId: String(doc.courseId),
    studentId: String(doc.studentId),
    submittedAt: doc.submittedAt,
    isLate: doc.isLate,
    answers: doc.answers ?? [],
    fileUploads: doc.fileUploads ?? [],
    textResponse: doc.textResponse ?? undefined,
    status: doc.status,
    rubricScores: doc.rubricScores ?? [],
    totalScore: doc.totalScore ?? null,
    totalScorePercent: doc.totalScorePercent ?? null,
    instructorComment: doc.instructorComment ?? null,
    gradedBy: idOf(doc.gradedBy),
    gradedAt: doc.gradedAt ?? null,
  };
}
