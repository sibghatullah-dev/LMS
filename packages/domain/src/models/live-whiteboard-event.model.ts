import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

const whiteboardPointSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { _id: false },
);

/** `live_whiteboard_events` collection (FR-LIVE-05). */
const liveWhiteboardEventSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    liveSessionId: { type: Schema.Types.ObjectId, ref: 'LiveSession', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['stroke', 'clear'], required: true },
    color: { type: String },
    width: { type: Number },
    points: { type: [whiteboardPointSchema], default: [] },
  },
  { timestamps: true, collection: 'live_whiteboard_events' },
);

liveWhiteboardEventSchema.index({ institutionId: 1, liveSessionId: 1, createdAt: 1 });

export type LiveWhiteboardEvent = InferSchemaType<typeof liveWhiteboardEventSchema>;

export const LiveWhiteboardEventModel: Model<LiveWhiteboardEvent> =
  (models.LiveWhiteboardEvent as Model<LiveWhiteboardEvent>) ??
  model<LiveWhiteboardEvent>('LiveWhiteboardEvent', liveWhiteboardEventSchema);
