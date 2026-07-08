import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

/** `live_breakout_rooms` collection (FR-LIVE-07). */
const liveBreakoutRoomSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    liveSessionId: { type: Schema.Types.ObjectId, ref: 'LiveSession', required: true },
    name: { type: String, required: true },
    participantIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    recalledAt: { type: Date },
  },
  { timestamps: true, collection: 'live_breakout_rooms' },
);

liveBreakoutRoomSchema.index({ institutionId: 1, liveSessionId: 1, createdAt: 1 });

export type LiveBreakoutRoom = InferSchemaType<typeof liveBreakoutRoomSchema>;

export const LiveBreakoutRoomModel: Model<LiveBreakoutRoom> =
  (models.LiveBreakoutRoom as Model<LiveBreakoutRoom>) ??
  model<LiveBreakoutRoom>('LiveBreakoutRoom', liveBreakoutRoomSchema);
