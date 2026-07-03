import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { ENROLLMENT_STATUSES } from '@lumora/config';

const { Schema, model, models } = mongoose;

/**
 * `enrollments` collection (DDD §3.4). The Student ↔ Course relationship and its
 * lifecycle. Kept as its own collection (not embedded in courses) because it is
 * medium-write and queried independently (a student's enrollments, a course's
 * roster). The `{ studentId, courseId }` unique index prevents double-enrollment.
 */
const enrollmentSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ENROLLMENT_STATUSES, required: true },
    enrolledAt: { type: Date, default: () => new Date() },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    completedAt: { type: Date },
    finalGradePercent: { type: Number },
    droppedReason: { type: String },
    droppedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'enrollments' },
);

enrollmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
enrollmentSchema.index({ courseId: 1, status: 1 });
enrollmentSchema.index({ institutionId: 1, status: 1 });

export type Enrollment = InferSchemaType<typeof enrollmentSchema>;

export const EnrollmentModel: Model<Enrollment> =
  (models.Enrollment as Model<Enrollment>) ?? model<Enrollment>('Enrollment', enrollmentSchema);
