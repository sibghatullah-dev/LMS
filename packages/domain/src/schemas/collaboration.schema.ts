import { z } from 'zod';

export const forumThreadListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ForumThreadListInput = z.infer<typeof forumThreadListSchema>;

export const forumThreadCreateSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  mode: z.enum(['discussion', 'qa']).default('discussion'),
});
export type ForumThreadCreateInput = z.infer<typeof forumThreadCreateSchema>;

export const forumReplyCreateSchema = z.object({
  body: z.string().min(1).max(4000),
  parentPostId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});
export type ForumReplyCreateInput = z.infer<typeof forumReplyCreateSchema>;

export const forumAcceptAnswerSchema = z.object({
  postId: z.string().regex(/^[a-f\d]{24}$/i),
});
export type ForumAcceptAnswerInput = z.infer<typeof forumAcceptAnswerSchema>;

export const conversationListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ConversationListInput = z.infer<typeof conversationListSchema>;

export const conversationCreateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('direct'),
    participantId: z.string().regex(/^[a-f\d]{24}$/i),
    initialMessage: z.string().min(1).max(4000).optional(),
  }),
  z.object({
    kind: z.literal('group'),
    title: z.string().min(1).max(200),
    participantIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1),
    initialMessage: z.string().min(1).max(4000).optional(),
  }),
]);
export type ConversationCreateInput = z.infer<typeof conversationCreateSchema>;

export const conversationMessageCreateSchema = z.object({
  body: z.string().min(1).max(4000),
});
export type ConversationMessageCreateInput = z.infer<typeof conversationMessageCreateSchema>;
