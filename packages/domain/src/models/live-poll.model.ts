import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

const livePollResponseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    optionIndex: { type: Number, required: true },
    respondedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

/** `live_polls` collection (FR-LIVE-04). */
const livePollSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    liveSessionId: { type: Schema.Types.ObjectId, ref: 'LiveSession', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    closedAt: { type: Date },
    responses: { type: [livePollResponseSchema], default: [] },
  },
  { timestamps: true, collection: 'live_polls' },
);

livePollSchema.index({ institutionId: 1, liveSessionId: 1, createdAt: -1 });

export type LivePoll = InferSchemaType<typeof livePollSchema>;

export const LivePollModel: Model<LivePoll> =
  (models.LivePoll as Model<LivePoll>) ?? model<LivePoll>('LivePoll', livePollSchema);
