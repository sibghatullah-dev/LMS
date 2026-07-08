import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

const forumPostSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    threadId: { type: Schema.Types.ObjectId, ref: 'ForumThread', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    parentPostId: { type: Schema.Types.ObjectId, ref: 'ForumPost' },
    body: { type: String, required: true },
  },
  { timestamps: true, collection: 'forum_posts' },
);

forumPostSchema.index({ institutionId: 1, threadId: 1, createdAt: 1 });
forumPostSchema.index({ institutionId: 1, courseId: 1, authorId: 1 });

export type ForumPost = InferSchemaType<typeof forumPostSchema>;

export const ForumPostModel: Model<ForumPost> =
  (models.ForumPost as Model<ForumPost>) ?? model<ForumPost>('ForumPost', forumPostSchema);
