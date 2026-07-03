import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import {
  ASSESSMENT_STATUSES,
  ASSESSMENT_TYPES,
  QUESTION_TYPES,
  SUBMISSION_TYPES,
} from '@lumora/config';

const { Schema, model, models } = mongoose;

const rubricCriterionSchema = new Schema(
  {
    criterion: { type: String, required: true },
    maxPoints: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
  },
  { _id: false },
);

const quizQuestionSchema = new Schema(
  {
    questionType: { type: String, enum: QUESTION_TYPES, required: true },
    prompt: { type: String, required: true },
    options: { type: [String], default: [] },
    correctAnswer: { type: Schema.Types.Mixed },
    points: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const assessmentSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    moduleId: { type: Schema.Types.ObjectId },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ASSESSMENT_TYPES, required: true },
    title: { type: String, required: true },
    instructions: { type: String, default: '' },
    dueAt: { type: Date },
    allowLateSubmission: { type: Boolean, default: false },
    latePenaltyPercentPerDay: { type: Number, min: 0, max: 100 },
    maxScore: { type: Number, required: true, min: 0 },
    weightPercent: { type: Number, default: 0, min: 0, max: 100 },
    submissionTypes: { type: [String], enum: SUBMISSION_TYPES, default: [] },
    rubric: { type: [rubricCriterionSchema], default: [] },
    questions: { type: [quizQuestionSchema], default: [] },
    status: { type: String, enum: ASSESSMENT_STATUSES, default: 'draft', required: true },
    revisionOf: { type: Schema.Types.ObjectId, ref: 'Assessment' },
  },
  { timestamps: true, collection: 'assessments' },
);

assessmentSchema.index({ courseId: 1, status: 1 });
assessmentSchema.index({ courseId: 1, dueAt: 1 });

export type Assessment = InferSchemaType<typeof assessmentSchema>;
export type RubricCriterion = InferSchemaType<typeof rubricCriterionSchema>;
export type QuizQuestion = InferSchemaType<typeof quizQuestionSchema>;

export const AssessmentModel: Model<Assessment> =
  (models.Assessment as Model<Assessment>) ?? model<Assessment>('Assessment', assessmentSchema);
