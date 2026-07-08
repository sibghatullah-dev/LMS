import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

const conversationSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['direct', 'group'], required: true },
    title: { type: String },
    directKey: { type: String },
    participantIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    lastMessageAt: { type: Date },
    lastMessagePreview: { type: String },
  },
  { timestamps: true, collection: 'conversations' },
);

conversationSchema.index({ institutionId: 1, courseId: 1, lastMessageAt: -1 });
conversationSchema.index({ institutionId: 1, courseId: 1, participantIds: 1 });
conversationSchema.index({ directKey: 1 }, { unique: true, sparse: true });

export type Conversation = InferSchemaType<typeof conversationSchema>;

export const ConversationModel: Model<Conversation> =
  (models.Conversation as Model<Conversation>) ??
  model<Conversation>('Conversation', conversationSchema);
