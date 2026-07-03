import { z } from 'zod';
import {
  ASSESSMENT_STATUSES,
  ASSESSMENT_TYPES,
  QUESTION_TYPES,
  SUBMISSION_STATUSES,
  SUBMISSION_TYPES,
} from '@lumora/config';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Expected a MongoDB ObjectId.');

export const rubricCriterionSchema = z.object({
  criterion: z.string().min(1).max(200),
  maxPoints: z.number().min(0),
  description: z.string().max(2000).optional(),
});

const OBJECTIVE_QUESTION_TYPES = ['multiple_choice', 'true_false', 'matching'] as const;

export const quizQuestionSchema = z
  .object({
    questionType: z.enum(QUESTION_TYPES),
    prompt: z.string().min(1).max(4000),
    options: z.array(z.string().min(1).max(500)).default([]),
    correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
    points: z.number().min(0),
  })
  .superRefine((q, ctx) => {
    // An objective question missing its correctAnswer auto-grades every student
    // as wrong with no error surfaced — silently corrupt scores. Only `essay`
    // (manually graded) may omit it.
    const isEmpty = q.correctAnswer == null || (Array.isArray(q.correctAnswer) && q.correctAnswer.length === 0) || q.correctAnswer === '';
    if ((OBJECTIVE_QUESTION_TYPES as readonly string[]).includes(q.questionType) && isEmpty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correctAnswer'],
        message: `A "${q.questionType}" question requires a correctAnswer.`,
      });
    }
  });

const assessmentInputBaseSchema = z
  .object({
    moduleId: objectIdSchema.optional(),
    type: z.enum(ASSESSMENT_TYPES),
    title: z.string().min(1).max(200),
    instructions: z.string().max(10000).optional(),
    dueAt: z.coerce.date().optional(),
    allowLateSubmission: z.boolean().default(false),
    latePenaltyPercentPerDay: z.number().min(0).max(100).optional(),
    maxScore: z.number().positive(),
    weightPercent: z.number().min(0).max(100).default(0),
    submissionTypes: z.array(z.enum(SUBMISSION_TYPES)).default([]),
    rubric: z.array(rubricCriterionSchema).default([]),
    questions: z.array(quizQuestionSchema).default([]),
    status: z.enum(ASSESSMENT_STATUSES).default('draft'),
  });

export const createAssessmentSchema = assessmentInputBaseSchema
  .superRefine((input, ctx) => {
    if (input.type === 'assignment' && input.submissionTypes.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['submissionTypes'],
        message: 'Assignments require at least one submission type.',
      });
    }
    if (input.type === 'quiz' && input.questions.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['questions'],
        message: 'Quizzes require at least one question.',
      });
    }
  });
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const updateAssessmentSchema = assessmentInputBaseSchema
  .omit({ type: true })
  .partial()
  .strict();
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;

const fileUploadSchema = z.object({
  storageKey: z.string().min(1),
  fileName: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().nonnegative(),
});

export const submissionAnswerSchema = z.object({
  questionId: objectIdSchema,
  response: z.union([z.string(), z.array(z.string())]),
});

export const createSubmissionSchema = z.object({
  answers: z.array(submissionAnswerSchema).default([]),
  textResponse: z.string().max(50000).optional(),
  fileUploads: z.array(fileUploadSchema).default([]),
  fileStorageKeys: z.array(z.string().min(1)).default([]),
});
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

export const rubricScoreSchema = z.object({
  criterion: z.string().min(1).max(200),
  pointsAwarded: z.number().min(0),
  comment: z.string().max(5000).optional(),
});

export const gradeSubmissionSchema = z.object({
  rubricScores: z.array(rubricScoreSchema).optional(),
  totalScore: z.number().min(0).optional(),
  instructorComment: z.string().max(10000).optional(),
});
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;

export const bulkGradeSchema = z.object({
  submissionIds: z.array(objectIdSchema).min(1),
  totalScore: z.number().min(0),
  instructorComment: z.string().max(10000).optional(),
});
export type BulkGradeInput = z.infer<typeof bulkGradeSchema>;

export const listSubmissionsSchema = z.object({
  status: z.enum(SUBMISSION_STATUSES).optional(),
});
export type ListSubmissionsInput = z.infer<typeof listSubmissionsSchema>;
