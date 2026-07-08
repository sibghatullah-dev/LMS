import mongoose, { type HydratedDocument } from 'mongoose';
import {
  CourseModel,
  ConversationMessageModel,
  ConversationModel,
  EnrollmentModel,
  ForumPostModel,
  ForumThreadModel,
  UserModel,
} from '../models';
import type { Course } from '../models/course.model';
import type { Conversation } from '../models/conversation.model';
import type { ConversationMessage } from '../models/conversation-message.model';
import type { ForumPost } from '../models/forum-post.model';
import type { ForumThread } from '../models/forum-thread.model';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { hasAnyRole, type AuthContext } from '../rbac/roles';
import type {
  ConversationCreateInput,
  ConversationMessageCreateInput,
  ForumAcceptAnswerInput,
  ForumReplyCreateInput,
  ForumThreadCreateInput,
  ForumThreadListInput,
} from '../schemas/collaboration.schema';
import { notifyUser } from './notification.service';
import { publishRealtimeEvent } from './realtime.service';

const { Types } = mongoose;

type CourseDoc = HydratedDocument<Course>;
type ThreadDoc = HydratedDocument<ForumThread>;
type PostDoc = HydratedDocument<ForumPost>;
type ConversationDoc = HydratedDocument<Conversation>;
type MessageDoc = HydratedDocument<ConversationMessage>;

export interface PublicForumPost {
  id: string;
  threadId: string;
  authorId: string;
  authorName?: string;
  authorRole?: string;
  parentPostId?: string;
  body: string;
  createdAt?: string;
}

export interface PublicForumThread {
  id: string;
  courseId: string;
  createdById: string;
  title: string;
  mode: ForumThread['mode'];
  starterPostId: string;
  acceptedAnswerPostId?: string;
  replyCount: number;
  lastPostAt?: string;
  createdAt?: string;
}

export interface PublicConversation {
  id: string;
  courseId: string;
  kind: Conversation['kind'];
  title?: string;
  participantIds: string[];
  participantNames: Record<string, string>;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  createdAt?: string;
}

export interface PublicConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  senderRole?: string;
  body: string;
  createdAt?: string;
}

export interface PublicCourseMember {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

export interface PublicForumThreadDetail extends PublicForumThread {
  posts: PublicForumPost[];
}

function toPublicForumThread(thread: ThreadDoc): PublicForumThread {
  return {
    id: String(thread._id),
    courseId: String(thread.courseId),
    createdById: String(thread.createdById),
    title: thread.title,
    mode: thread.mode,
    starterPostId: String(thread.starterPostId),
    acceptedAnswerPostId: thread.acceptedAnswerPostId
      ? String(thread.acceptedAnswerPostId)
      : undefined,
    replyCount: thread.replyCount ?? 0,
    lastPostAt: thread.lastPostAt?.toISOString(),
    createdAt: thread.createdAt?.toISOString(),
  };
}

function toPublicForumPost(post: PostDoc, user?: { _id: unknown; fullName?: string; role?: string }): PublicForumPost {
  return {
    id: String(post._id),
    threadId: String(post.threadId),
    authorId: String(post.authorId),
    authorName: user?.fullName,
    authorRole: user?.role,
    parentPostId: post.parentPostId ? String(post.parentPostId) : undefined,
    body: post.body,
    createdAt: post.createdAt?.toISOString(),
  };
}

function toPublicConversation(
  conversation: ConversationDoc,
  users: Array<{ _id: unknown; fullName?: string }>,
): PublicConversation {
  const participantNames = Object.fromEntries(
    users.map((u) => [String(u._id), u.fullName ?? 'Unknown user']),
  );
  return {
    id: String(conversation._id),
    courseId: String(conversation.courseId),
    kind: conversation.kind,
    title: conversation.title ?? undefined,
    participantIds: (conversation.participantIds ?? []).map(String),
    participantNames,
    lastMessageAt: conversation.lastMessageAt?.toISOString(),
    lastMessagePreview: conversation.lastMessagePreview ?? undefined,
    createdAt: conversation.createdAt?.toISOString(),
  };
}

function toPublicConversationMessage(
  message: MessageDoc,
  user?: { _id: unknown; fullName?: string; role?: string },
): PublicConversationMessage {
  return {
    id: String(message._id),
    conversationId: String(message.conversationId),
    senderId: String(message.senderId),
    senderName: user?.fullName,
    senderRole: user?.role,
    body: message.body,
    createdAt: message.createdAt?.toISOString(),
  };
}

async function loadCourse(ctx: AuthContext, courseId: string): Promise<CourseDoc> {
  if (!Types.ObjectId.isValid(courseId)) throw NotFoundError('Course not found.');
  const course = await CourseModel.findOne({ _id: courseId, institutionId: ctx.institutionId });
  if (!course) throw NotFoundError('Course not found.');
  return course;
}

async function assertCourseAccess(ctx: AuthContext, course: CourseDoc): Promise<void> {
  if (hasAnyRole(ctx.role, ['admin', 'super_admin'])) return;
  if (String(course.instructorId) === ctx.userId) return;

  const enrollment = await EnrollmentModel.findOne({
    institutionId: ctx.institutionId,
    courseId: course._id,
    studentId: ctx.userId,
    status: { $in: ['active', 'completed'] },
  }).select('_id');
  if (enrollment) return;
  throw ForbiddenError('You do not have access to this course context.');
}

async function assertParticipantSharesCourse(ctx: AuthContext, course: CourseDoc, userId: string) {
  if (!Types.ObjectId.isValid(userId)) throw NotFoundError('User not found.');
  const user = await UserModel.findOne({ _id: userId, institutionId: ctx.institutionId }).select('_id');
  if (!user) throw NotFoundError('User not found.');
  if (String(course.instructorId) === userId) return;
  const enrollment = await EnrollmentModel.findOne({
    institutionId: ctx.institutionId,
    courseId: course._id,
    studentId: userId,
    status: { $in: ['active', 'completed'] },
  }).select('_id');
  if (!enrollment) throw ForbiddenError('Users must share the same course context.');
}

function uniqIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => String(id)))].sort();
}

async function notifyForumParticipants(
  ctx: AuthContext,
  courseId: string,
  threadId: string,
  senderId: string,
) {
  const posts = await ForumPostModel.find({
    courseId,
    threadId,
  }).select('authorId');
  const recipients = uniqIds([...(posts.map((post) => String(post.authorId)) as string[]), senderId]).filter(
    (id) => id !== senderId,
  );
  await Promise.all(
    recipients.map((userId) =>
      notifyUser({
        institutionId: ctx.institutionId,
        userId,
        type: 'forum_reply',
        title: 'New forum activity',
        body: 'A discussion you follow has a new reply.',
        actionUrl: `/courses/${courseId}/forum/${threadId}`,
        relatedEntity: { type: 'forum_thread', id: threadId },
      }),
    ),
  );
  publishRealtimeEvent({
    type: 'forum.reply.created',
    institutionId: ctx.institutionId,
    courseId,
    threadId,
    userIds: recipients,
    payload: { courseId, threadId, senderId },
    createdAt: new Date().toISOString(),
  });
}

async function notifyConversationParticipants(
  ctx: AuthContext,
  conversation: ConversationDoc,
  senderId: string,
  message: string,
) {
  const recipients = uniqIds((conversation.participantIds ?? []).map(String)).filter((id) => id !== senderId);
  await Promise.all(
    recipients.map((userId) =>
      notifyUser({
        institutionId: ctx.institutionId,
        userId,
        type: 'direct_message',
        title: conversation.title ?? 'New message',
        body: message.slice(0, 120),
        actionUrl: `/messages`,
        relatedEntity: { type: 'conversation', id: conversation._id },
      }),
    ),
  );
  publishRealtimeEvent({
    type: 'conversation.message.created',
    institutionId: ctx.institutionId,
    courseId: String(conversation.courseId),
    conversationId: String(conversation._id),
    userIds: recipients,
    payload: {
      courseId: String(conversation.courseId),
      conversationId: String(conversation._id),
      senderId,
      preview: message.slice(0, 120),
    },
    createdAt: new Date().toISOString(),
  });
}

export async function listForumThreads(
  ctx: AuthContext,
  courseId: string,
  input: ForumThreadListInput,
) {
  const course = await loadCourse(ctx, courseId);
  await assertCourseAccess(ctx, course);

  const filter = { institutionId: ctx.institutionId, courseId: course._id };
  const [threads, total] = await Promise.all([
    ForumThreadModel.find(filter)
      .sort({ lastPostAt: -1, createdAt: -1 })
      .skip((input.page - 1) * input.pageSize)
      .limit(input.pageSize),
    ForumThreadModel.countDocuments(filter),
  ]);

  return {
    threads: threads.map(toPublicForumThread),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function getForumThread(ctx: AuthContext, courseId: string, threadId: string) {
  const course = await loadCourse(ctx, courseId);
  await assertCourseAccess(ctx, course);
  if (!Types.ObjectId.isValid(threadId)) throw NotFoundError('Thread not found.');

  const thread = await ForumThreadModel.findOne({
    _id: threadId,
    institutionId: ctx.institutionId,
    courseId: course._id,
  });
  if (!thread) throw NotFoundError('Thread not found.');

  const posts = await ForumPostModel.find({
    institutionId: ctx.institutionId,
    courseId: course._id,
    threadId: thread._id,
  })
    .sort({ createdAt: 1 })
    .lean();
  const authors = await UserModel.find({
    _id: { $in: posts.map((post) => post.authorId) },
    institutionId: ctx.institutionId,
  })
    .select('fullName role')
    .lean();
  const authorMap = new Map(authors.map((author) => [String(author._id), author]));

  return {
    ...toPublicForumThread(thread),
    posts: posts.map((post) => toPublicForumPost(post as PostDoc, authorMap.get(String(post.authorId)))),
  };
}

export async function createForumThread(
  ctx: AuthContext,
  courseId: string,
  input: ForumThreadCreateInput,
) {
  const course = await loadCourse(ctx, courseId);
  await assertCourseAccess(ctx, course);

  const thread = await ForumThreadModel.create({
    institutionId: ctx.institutionId,
    courseId: course._id,
    createdById: ctx.userId,
    title: input.title,
    mode: input.mode,
    starterPostId: new Types.ObjectId(),
    replyCount: 0,
  });
  const starterPost = await ForumPostModel.create({
    institutionId: ctx.institutionId,
    courseId: course._id,
    threadId: thread._id,
    authorId: ctx.userId,
    body: input.body,
  });
  thread.starterPostId = starterPost._id;
  thread.lastPostAt = starterPost.createdAt ?? new Date();
  await thread.save();
  publishRealtimeEvent({
    type: 'forum.thread.created',
    institutionId: ctx.institutionId,
    courseId: String(course._id),
    threadId: String(thread._id),
    payload: {
      courseId: String(course._id),
      threadId: String(thread._id),
      title: thread.title,
    },
    createdAt: new Date().toISOString(),
  });
  return toPublicForumThread(thread);
}

export async function replyForumThread(
  ctx: AuthContext,
  courseId: string,
  threadId: string,
  input: ForumReplyCreateInput,
) {
  const course = await loadCourse(ctx, courseId);
  await assertCourseAccess(ctx, course);
  if (!Types.ObjectId.isValid(threadId)) throw NotFoundError('Thread not found.');
  const thread = await ForumThreadModel.findOne({
    _id: threadId,
    institutionId: ctx.institutionId,
    courseId: course._id,
  });
  if (!thread) throw NotFoundError('Thread not found.');
  if (input.parentPostId && !Types.ObjectId.isValid(input.parentPostId)) {
    throw NotFoundError('Parent post not found.');
  }
  if (input.parentPostId) {
    const parent = await ForumPostModel.findOne({
      _id: input.parentPostId,
      institutionId: ctx.institutionId,
      courseId: course._id,
      threadId: thread._id,
    }).select('_id');
    if (!parent) throw NotFoundError('Parent post not found.');
  }

  const post = await ForumPostModel.create({
    institutionId: ctx.institutionId,
    courseId: course._id,
    threadId: thread._id,
    authorId: ctx.userId,
    parentPostId: input.parentPostId,
    body: input.body,
  });

  thread.replyCount = (thread.replyCount ?? 0) + 1;
  thread.lastPostAt = post.createdAt ?? new Date();
  await thread.save();

  await notifyForumParticipants(ctx, String(course._id), String(thread._id), ctx.userId);
  return toPublicForumPost(post as PostDoc);
}

export async function acceptForumAnswer(
  ctx: AuthContext,
  courseId: string,
  threadId: string,
  input: ForumAcceptAnswerInput,
) {
  const course = await loadCourse(ctx, courseId);
  await assertCourseAccess(ctx, course);
  if (!hasAnyRole(ctx.role, ['instructor', 'admin', 'super_admin'])) {
    throw ForbiddenError('Only instructors can mark an accepted answer.');
  }
  if (!Types.ObjectId.isValid(threadId) || !Types.ObjectId.isValid(input.postId)) {
    throw NotFoundError('Thread or post not found.');
  }
  const thread = await ForumThreadModel.findOne({
    _id: threadId,
    institutionId: ctx.institutionId,
    courseId: course._id,
  });
  if (!thread) throw NotFoundError('Thread not found.');
  if (thread.mode !== 'qa') throw ValidationError('Accepted answers are only available in Q&A threads.');

  const post = await ForumPostModel.findOne({
    _id: input.postId,
    institutionId: ctx.institutionId,
    courseId: course._id,
    threadId: thread._id,
  });
  if (!post) throw NotFoundError('Post not found.');

  const author = await UserModel.findOne({
    _id: post.authorId,
    institutionId: ctx.institutionId,
    role: 'instructor',
  }).select('_id');
  if (!author) throw ValidationError('Accepted answer must be an instructor reply.');

  thread.acceptedAnswerPostId = post._id;
  await thread.save();
  return toPublicForumThread(thread);
}

export async function listCourseConversations(
  ctx: AuthContext,
  courseId: string,
  input: ForumThreadListInput,
) {
  const course = await loadCourse(ctx, courseId);
  await assertCourseAccess(ctx, course);
  const filter = {
    institutionId: ctx.institutionId,
    courseId: course._id,
    participantIds: ctx.userId,
  };
  const [conversations, total] = await Promise.all([
    ConversationModel.find(filter)
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .skip((input.page - 1) * input.pageSize)
      .limit(input.pageSize),
    ConversationModel.countDocuments(filter),
  ]);
  const userIds = uniqIds(conversations.flatMap((conversation) => conversation.participantIds.map(String)));
  const users = await UserModel.find({ _id: { $in: userIds }, institutionId: ctx.institutionId })
    .select('fullName')
    .lean();
  const map = new Map(users.map((user) => [String(user._id), user.fullName ?? 'Unknown user']));
  return {
    conversations: conversations.map((conversation) =>
      toPublicConversation(conversation, (conversation.participantIds ?? []).map((id) => ({
        _id: id,
        fullName: map.get(String(id)),
      }))),
    ),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function createConversation(
  ctx: AuthContext,
  courseId: string,
  input: ConversationCreateInput,
) {
  const course = await loadCourse(ctx, courseId);
  await assertCourseAccess(ctx, course);

  let participantIds: string[] = [ctx.userId];
  let title: string | undefined;
  let directKey: string | undefined;

  if (input.kind === 'direct') {
    await assertParticipantSharesCourse(ctx, course, input.participantId);
    participantIds = uniqIds([ctx.userId, input.participantId]);
    directKey = `direct:${String(course._id)}:${participantIds.join(':')}`;
  } else {
    participantIds = uniqIds([ctx.userId, ...input.participantIds]);
    await Promise.all(participantIds.map((participantId) => assertParticipantSharesCourse(ctx, course, participantId)));
    title = input.title;
  }

  const conversation =
    input.kind === 'direct'
      ? await ConversationModel.findOne({
          institutionId: ctx.institutionId,
          directKey,
        })
      : null;

  const doc =
    conversation ??
    (await ConversationModel.create({
      institutionId: ctx.institutionId,
      courseId: course._id,
      createdById: ctx.userId,
      kind: input.kind,
      title,
      directKey,
      participantIds,
    }));

  if (input.initialMessage) {
    const message = await ConversationMessageModel.create({
      institutionId: ctx.institutionId,
      courseId: course._id,
      conversationId: doc._id,
      senderId: ctx.userId,
      body: input.initialMessage,
    });
    doc.lastMessageAt = message.createdAt ?? new Date();
    doc.lastMessagePreview = message.body.slice(0, 120);
    await doc.save();
    await notifyConversationParticipants(ctx, doc, ctx.userId, message.body);
  }
  publishRealtimeEvent({
    type: 'conversation.created',
    institutionId: ctx.institutionId,
    courseId: String(course._id),
    conversationId: String(doc._id),
    userIds: participantIds,
    payload: {
      courseId: String(course._id),
      conversationId: String(doc._id),
      kind: doc.kind,
      title: doc.title,
    },
    createdAt: new Date().toISOString(),
  });

  const users = await UserModel.find({
    _id: { $in: doc.participantIds.map(String) },
    institutionId: ctx.institutionId,
  })
    .select('fullName')
    .lean();
  return toPublicConversation(
    doc,
    users.map((user) => ({ _id: user._id, fullName: user.fullName })),
  );
}

export async function getConversation(ctx: AuthContext, conversationId: string) {
  if (!Types.ObjectId.isValid(conversationId)) throw NotFoundError('Conversation not found.');
  const conversation = await ConversationModel.findOne({
    _id: conversationId,
    institutionId: ctx.institutionId,
    participantIds: ctx.userId,
  });
  if (!conversation) throw NotFoundError('Conversation not found.');
  const users = await UserModel.find({
    _id: { $in: conversation.participantIds.map(String) },
    institutionId: ctx.institutionId,
  })
    .select('fullName')
    .lean();
  return toPublicConversation(
    conversation,
    users.map((user) => ({ _id: user._id, fullName: user.fullName })),
  );
}

export async function listCourseMembers(ctx: AuthContext, courseId: string): Promise<{ members: PublicCourseMember[] }> {
  const course = await loadCourse(ctx, courseId);
  await assertCourseAccess(ctx, course);

  const enrollments = await EnrollmentModel.find({
    institutionId: ctx.institutionId,
    courseId: course._id,
    status: { $in: ['active', 'completed'] },
  }).select('studentId');
  const memberIds = uniqIds([
    String(course.instructorId),
    ...enrollments.map((enrollment) => String(enrollment.studentId)),
  ]);

  const users = await UserModel.find({
    institutionId: ctx.institutionId,
    _id: { $in: memberIds },
  })
    .select('fullName email role')
    .sort({ fullName: 1 })
    .lean();

  return {
    members: users.map((user) => ({
      id: String(user._id),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    })),
  };
}

export async function listConversationMessages(
  ctx: AuthContext,
  conversationId: string,
  input: ForumThreadListInput,
) {
  if (!Types.ObjectId.isValid(conversationId)) throw NotFoundError('Conversation not found.');
  const conversation = await ConversationModel.findOne({
    _id: conversationId,
    institutionId: ctx.institutionId,
    participantIds: ctx.userId,
  });
  if (!conversation) throw NotFoundError('Conversation not found.');

  const [messages, total] = await Promise.all([
    ConversationMessageModel.find({
      institutionId: ctx.institutionId,
      conversationId: conversation._id,
    })
      .sort({ createdAt: 1 })
      .skip((input.page - 1) * input.pageSize)
      .limit(input.pageSize),
    ConversationMessageModel.countDocuments({
      institutionId: ctx.institutionId,
      conversationId: conversation._id,
    }),
  ]);
  const users = await UserModel.find({
    _id: { $in: messages.map((message) => message.senderId) },
    institutionId: ctx.institutionId,
  })
    .select('fullName role')
    .lean();
  const map = new Map(users.map((user) => [String(user._id), user]));
  return {
    messages: messages.map((message) =>
      toPublicConversationMessage(message as MessageDoc, map.get(String(message.senderId))),
    ),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function sendConversationMessage(
  ctx: AuthContext,
  conversationId: string,
  input: ConversationMessageCreateInput,
) {
  if (!Types.ObjectId.isValid(conversationId)) throw NotFoundError('Conversation not found.');
  const conversation = await ConversationModel.findOne({
    _id: conversationId,
    institutionId: ctx.institutionId,
    participantIds: ctx.userId,
  });
  if (!conversation) throw NotFoundError('Conversation not found.');

  const message = await ConversationMessageModel.create({
    institutionId: ctx.institutionId,
    courseId: conversation.courseId,
    conversationId: conversation._id,
    senderId: ctx.userId,
    body: input.body,
  });

  conversation.lastMessageAt = message.createdAt ?? new Date();
  conversation.lastMessagePreview = input.body.slice(0, 120);
  await conversation.save();
  await notifyConversationParticipants(ctx, conversation, ctx.userId, input.body);
  publishRealtimeEvent({
    type: 'conversation.message.created',
    institutionId: ctx.institutionId,
    courseId: String(conversation.courseId),
    conversationId: String(conversation._id),
    userIds: uniqIds((conversation.participantIds ?? []).map(String)),
    payload: {
      courseId: String(conversation.courseId),
      conversationId: String(conversation._id),
      senderId: ctx.userId,
      preview: input.body.slice(0, 120),
    },
    createdAt: new Date().toISOString(),
  });

  return toPublicConversationMessage(message as MessageDoc);
}
