import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

const conversationMessageSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
  },
  { timestamps: true, collection: 'conversation_messages' },
);

conversationMessageSchema.index({ institutionId: 1, conversationId: 1, createdAt: 1 });
conversationMessageSchema.index({ institutionId: 1, courseId: 1, senderId: 1 });

export type ConversationMessage = InferSchemaType<typeof conversationMessageSchema>;

export const ConversationMessageModel: Model<ConversationMessage> =
  (models.ConversationMessage as Model<ConversationMessage>) ??
  model<ConversationMessage>('ConversationMessage', conversationMessageSchema);
