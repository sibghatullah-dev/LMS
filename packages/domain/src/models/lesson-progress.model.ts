import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { LESSON_PROGRESS_STATUSES } from '@lumora/config';

const { Schema, model, models } = mongoose;

/**
 * `lesson_progress` collection (DDD §3.5). High-write: one document per student
 * per lesson. Deliberately carries only the indexes its known query patterns need
 * (a student's progress in a lesson / across a course) to keep write latency low.
 */
const lessonProgressSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    moduleId: { type: Schema.Types.ObjectId, required: true },
    lessonId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, enum: LESSON_PROGRESS_STATUSES, default: 'not_started' },
    percentConsumed: { type: Number, default: 0 }, // 0-100, mainly video/audio
    lastAccessedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true, collection: 'lesson_progress' },
);

lessonProgressSchema.index({ studentId: 1, lessonId: 1 }, { unique: true });
lessonProgressSchema.index({ studentId: 1, courseId: 1 });

export type LessonProgress = InferSchemaType<typeof lessonProgressSchema>;

export const LessonProgressModel: Model<LessonProgress> =
  (models.LessonProgress as Model<LessonProgress>) ??
  model<LessonProgress>('LessonProgress', lessonProgressSchema);
