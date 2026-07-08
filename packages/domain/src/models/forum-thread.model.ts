import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

const forumThreadSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    mode: { type: String, enum: ['discussion', 'qa'], default: 'discussion' },
    starterPostId: { type: Schema.Types.ObjectId, ref: 'ForumPost', required: true },
    acceptedAnswerPostId: { type: Schema.Types.ObjectId, ref: 'ForumPost' },
    replyCount: { type: Number, default: 0 },
    lastPostAt: { type: Date },
  },
  { timestamps: true, collection: 'forum_threads' },
);

forumThreadSchema.index({ institutionId: 1, courseId: 1, lastPostAt: -1 });
forumThreadSchema.index({ institutionId: 1, courseId: 1, createdAt: -1 });

export type ForumThread = InferSchemaType<typeof forumThreadSchema>;

export const ForumThreadModel: Model<ForumThread> =
  (models.ForumThread as Model<ForumThread>) ?? model<ForumThread>('ForumThread', forumThreadSchema);
