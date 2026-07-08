import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

/** `live_chat_messages` collection (FR-LIVE-06). */
const liveChatMessageSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    liveSessionId: { type: Schema.Types.ObjectId, ref: 'LiveSession', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
  },
  { timestamps: true, collection: 'live_chat_messages' },
);

liveChatMessageSchema.index({ institutionId: 1, liveSessionId: 1, createdAt: 1 });

export type LiveChatMessage = InferSchemaType<typeof liveChatMessageSchema>;

export const LiveChatMessageModel: Model<LiveChatMessage> =
  (models.LiveChatMessage as Model<LiveChatMessage>) ??
  model<LiveChatMessage>('LiveChatMessage', liveChatMessageSchema);
