import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { LIVE_SESSION_DELIVERY_MODES, LIVE_SESSION_STATUSES } from '@lumora/config';

const { Schema, model, models } = mongoose;

/** `live_sessions` collection (DDD §3.8, FR-LIVE-01/03/09). */
const liveSessionSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    instructorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    deliveryMode: { type: String, enum: LIVE_SESSION_DELIVERY_MODES, required: true },
    status: { type: String, enum: LIVE_SESSION_STATUSES, default: 'scheduled', required: true },
    joinUrl: { type: String },
    providerMeetingId: { type: String },
    providerRecordingUrl: { type: String },
    recordingStorageKey: { type: String },
    startedAt: { type: Date },
    endedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true, collection: 'live_sessions' },
);

liveSessionSchema.index({ institutionId: 1, courseId: 1, scheduledStart: -1 });
liveSessionSchema.index({ institutionId: 1, status: 1, scheduledStart: 1 });
liveSessionSchema.index({ instructorId: 1, scheduledStart: -1 });

export type LiveSession = InferSchemaType<typeof liveSessionSchema>;

export const LiveSessionModel: Model<LiveSession> =
  (models.LiveSession as Model<LiveSession>) ??
  model<LiveSession>('LiveSession', liveSessionSchema);
