import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ConversationMessageModel,
  ConversationModel,
  CourseModel,
  EnrollmentModel,
  ForumPostModel,
  ForumThreadModel,
  InstitutionModel,
  NotificationModel,
  UserModel,
} from '../src/models';
import type { AuthContext } from '../src/rbac/roles';
import {
  acceptForumAnswer,
  createConversation,
  createForumThread,
  getForumThread,
  listCourseMembers,
  listCourseConversations,
  listForumThreads,
  replyForumThread,
  sendConversationMessage,
} from '../src/services/collaboration.service';

let seq = 0;

async function makeInstitution(slug: string) {
  const inst = await InstitutionModel.create({ name: slug, slug });
  return String(inst._id);
}

async function makeUser(institutionId: string, role: AuthContext['role']): Promise<AuthContext> {
  const u = await UserModel.create({
    institutionId,
    email: `${role}-${seq++}@x.com`,
    fullName: `${role} ${seq}`,
    role,
    status: 'active',
  });
  return { userId: String(u._id), institutionId, role };
}

async function makeCourse(institutionId: string, instructorId: string) {
  const c = await CourseModel.create({
    institutionId,
    instructorId,
    title: `Collab Course ${seq++}`,
    slug: `collab-course-${seq}`,
    status: 'published',
    enrollmentMode: 'open',
    modules: [{ title: 'M1', order: 0, lessons: [] }],
  });
  return String(c._id);
}

async function enroll(institutionId: string, courseId: string, studentId: string) {
  await EnrollmentModel.create({
    institutionId,
    courseId,
    studentId,
    status: 'active',
  });
}

let institutionId: string;
let instructor: AuthContext;
let student: AuthContext;
let peer: AuthContext;
let courseId: string;

beforeAll(async () => {
  await Promise.all([
    EnrollmentModel.createIndexes(),
    ForumThreadModel.createIndexes(),
    ForumPostModel.createIndexes(),
    ConversationModel.createIndexes(),
    ConversationMessageModel.createIndexes(),
    NotificationModel.createIndexes(),
  ]);
});

beforeEach(async () => {
  institutionId = await makeInstitution('lumora-collab');
  instructor = await makeUser(institutionId, 'instructor');
  student = await makeUser(institutionId, 'student');
  peer = await makeUser(institutionId, 'student');
  courseId = await makeCourse(institutionId, instructor.userId);
  await enroll(institutionId, courseId, student.userId);
  await enroll(institutionId, courseId, peer.userId);
});

describe('collaboration phase', () => {
  it('creates forum threads, threaded replies, and accepted answers', async () => {
    const thread = await createForumThread(student, courseId, {
      title: 'How do I approach this topic?',
      body: 'Initial question.',
      mode: 'qa',
    });
    expect(thread.replyCount).toBe(0);

    const reply = await replyForumThread(instructor, courseId, thread.id, {
      body: 'Start from the prerequisites.',
    });
    expect(reply.body).toContain('prerequisites');

    const detail = await getForumThread(student, courseId, thread.id);
    expect(detail.posts).toHaveLength(2);
    expect(detail.replyCount).toBe(1);

    const accepted = await acceptForumAnswer(instructor, courseId, thread.id, {
      postId: detail.posts[1]!.id,
    });
    expect(accepted.acceptedAnswerPostId).toBe(detail.posts[1]!.id);

    const threads = await listForumThreads(student, courseId, { page: 1, pageSize: 20 });
    expect(threads.threads[0]?.id).toBe(thread.id);
  });

  it('creates course-context conversations and sends direct-message notifications', async () => {
    const members = await listCourseMembers(student, courseId);
    expect(members.members.map((m) => m.id)).toContain(peer.userId);

    const conversation = await createConversation(student, courseId, {
      kind: 'direct',
      participantId: peer.userId,
      initialMessage: 'Hello there.',
    });
    expect(conversation.participantIds).toEqual(expect.arrayContaining([student.userId, peer.userId]));

    const message = await sendConversationMessage(peer, conversation.id, {
      body: 'Hi back.',
    });
    expect(message.body).toBe('Hi back.');

    const list = await listCourseConversations(student, courseId, { page: 1, pageSize: 20 });
    expect(list.conversations).toHaveLength(1);

    const notifications = await NotificationModel.find({
      institutionId,
      type: 'direct_message',
    }).lean();
    expect(notifications.length).toBeGreaterThan(0);
  });
});
