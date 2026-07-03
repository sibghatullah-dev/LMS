import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { SUBMISSION_STATUSES } from '@lumora/config';

const { Schema, model, models } = mongoose;

const answerSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    response: { type: Schema.Types.Mixed },
    autoGradedCorrect: { type: Boolean },
    pointsAwarded: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const fileUploadSchema = new Schema(
  {
    storageKey: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const rubricScoreSchema = new Schema(
  {
    criterion: { type: String, required: true },
    pointsAwarded: { type: Number, required: true, min: 0 },
    comment: { type: String, default: '' },
  },
  { _id: false },
);

const submissionSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    submittedAt: { type: Date, required: true },
    isLate: { type: Boolean, default: false },
    answers: { type: [answerSchema], default: [] },
    fileUploads: { type: [fileUploadSchema], default: [] },
    textResponse: { type: String },
    status: { type: String, enum: SUBMISSION_STATUSES, default: 'submitted', required: true },
    rubricScores: { type: [rubricScoreSchema], default: [] },
    totalScore: { type: Number },
    totalScorePercent: { type: Number },
    instructorComment: { type: String },
    gradedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    gradedAt: { type: Date },
  },
  { timestamps: true, collection: 'submissions' },
);

submissionSchema.index({ assessmentId: 1, studentId: 1 }, { unique: true });
submissionSchema.index({ courseId: 1, status: 1 });
submissionSchema.index({ studentId: 1, courseId: 1 });

export type Submission = InferSchemaType<typeof submissionSchema>;
export type SubmissionAnswer = InferSchemaType<typeof answerSchema>;
export type SubmissionFileUpload = InferSchemaType<typeof fileUploadSchema>;
export type RubricScore = InferSchemaType<typeof rubricScoreSchema>;

export const SubmissionModel: Model<Submission> =
  (models.Submission as Model<Submission>) ?? model<Submission>('Submission', submissionSchema);
