import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { ATTENDANCE_SOURCES } from '@lumora/config';

const { Schema, model, models } = mongoose;

/** `attendance` collection (DDD §3.9, FR-LIVE-10/11). */
const attendanceSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    liveSessionId: { type: Schema.Types.ObjectId, ref: 'LiveSession', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date },
    leftAt: { type: Date },
    durationSeconds: { type: Number, default: 0 },
    present: { type: Boolean, default: false },
    source: { type: String, enum: ATTENDANCE_SOURCES, default: 'manual' },
    overrideReason: { type: String },
    overriddenBy: { type: Schema.Types.ObjectId, ref: 'User' },
    overriddenAt: { type: Date },
  },
  { timestamps: true, collection: 'attendance' },
);

attendanceSchema.index({ liveSessionId: 1, studentId: 1 }, { unique: true });
attendanceSchema.index({ institutionId: 1, courseId: 1, studentId: 1 });

export type Attendance = InferSchemaType<typeof attendanceSchema>;

export const AttendanceModel: Model<Attendance> =
  (models.Attendance as Model<Attendance>) ?? model<Attendance>('Attendance', attendanceSchema);
