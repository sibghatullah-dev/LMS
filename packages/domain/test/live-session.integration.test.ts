import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AttendanceModel,
  CourseModel,
  EnrollmentModel,
  InstitutionModel,
  NotificationModel,
  UserModel,
} from '../src/models';
import { AuditLogModel } from '../src/models/audit-log.model';
import {
  createLiveSessionJoinToken,
  listLiveSessions,
  listSessionAttendance,
  overrideAttendance,
  scheduleLiveSession,
} from '../src/services/live-session.service';
import { createDueLiveSessionReminders } from '../src/services/notification.service';
import type { AuthContext } from '../src/rbac/roles';

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
    title: `Live Course ${seq++}`,
    slug: `live-course-${seq}`,
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
let courseId: string;

beforeAll(async () => {
  await Promise.all([
    EnrollmentModel.createIndexes(),
    AttendanceModel.createIndexes(),
  ]);
});

beforeEach(async () => {
  institutionId = await makeInstitution('lumora');
  instructor = await makeUser(institutionId, 'instructor');
  student = await makeUser(institutionId, 'student');
  courseId = await makeCourse(institutionId, instructor.userId);
  await enroll(institutionId, courseId, student.userId);
});

describe('live sessions (FR-LIVE-01/03/10/11)', () => {
  it('schedules an external session, lists it for enrolled students, and creates attendance rows', async () => {
    const session = await scheduleLiveSession(instructor, courseId, {
      title: 'Weekly workshop',
      description: 'Bring questions.',
      scheduledStart: new Date('2030-01-01T10:00:00Z'),
      scheduledEnd: new Date('2030-01-01T11:00:00Z'),
      deliveryMode: 'zoom',
      joinUrl: 'https://zoom.example.com/j/123',
    });

    expect(session.deliveryMode).toBe('zoom');
    expect(session.joinUrl).toBe('https://zoom.example.com/j/123');

    const visible = await listLiveSessions(student, courseId);
    expect(visible.map((s) => s.id)).toContain(session.id);

    const attendance = await listSessionAttendance(instructor, session.id);
    expect(attendance).toHaveLength(1);
    expect(attendance[0]!.studentId).toBe(student.userId);
    expect(attendance[0]!.present).toBe(false);

    const audit = await AuditLogModel.findOne({
      action: 'live_session.schedule',
      'targetEntity.id': session.id,
    }).lean();
    expect(audit).toBeTruthy();
  });

  it('blocks non-enrolled students from viewing sessions', async () => {
    const outsider = await makeUser(institutionId, 'student');
    await scheduleLiveSession(instructor, courseId, {
      title: 'Private session',
      scheduledStart: new Date('2030-01-01T10:00:00Z'),
      scheduledEnd: new Date('2030-01-01T11:00:00Z'),
      deliveryMode: 'zoom',
      joinUrl: 'https://zoom.example.com/j/123',
    });

    await expect(listLiveSessions(outsider, courseId)).rejects.toMatchObject({ httpStatus: 403 });
  });

  it('returns external join links and native join tokens', async () => {
    const external = await scheduleLiveSession(instructor, courseId, {
      title: 'Teams session',
      scheduledStart: new Date('2030-01-01T10:00:00Z'),
      scheduledEnd: new Date('2030-01-01T11:00:00Z'),
      deliveryMode: 'ms_teams',
      joinUrl: 'https://teams.example.com/l/meetup-join/123',
    });
    await expect(createLiveSessionJoinToken(student, external.id)).resolves.toMatchObject({
      joinUrl: 'https://teams.example.com/l/meetup-join/123',
    });

    const native = await scheduleLiveSession(instructor, courseId, {
      title: 'Native session',
      scheduledStart: new Date('2030-01-02T10:00:00Z'),
      scheduledEnd: new Date('2030-01-02T11:00:00Z'),
      deliveryMode: 'native',
    });
    const token = await createLiveSessionJoinToken(student, native.id);
    expect(token.joinToken.length).toBeGreaterThan(20);
    expect(token.mediaServiceUrl).toBe('http://localhost:3000');
  });

  it('allows audited manual attendance overrides', async () => {
    const session = await scheduleLiveSession(instructor, courseId, {
      title: 'Attendance session',
      scheduledStart: new Date('2030-01-01T10:00:00Z'),
      scheduledEnd: new Date('2030-01-01T11:00:00Z'),
      deliveryMode: 'native',
    });
    const [record] = await listSessionAttendance(instructor, session.id);

    const updated = await overrideAttendance(instructor, record!.id, {
      present: true,
      durationSeconds: 3600,
      source: 'manual',
      overrideReason: 'Student attended via backup device.',
    });

    expect(updated.present).toBe(true);
    expect(updated.durationSeconds).toBe(3600);

    const audit = await AuditLogModel.findOne({
      action: 'attendance.override',
      'targetEntity.id': record!.id,
    }).lean();
    expect(audit).toBeTruthy();
  });

  it('creates deduped 1-day and 15-minute reminders for enrolled learners', async () => {
    await scheduleLiveSession(instructor, courseId, {
      title: 'Reminder session',
      scheduledStart: new Date('2030-01-02T10:00:00Z'),
      scheduledEnd: new Date('2030-01-02T11:00:00Z'),
      deliveryMode: 'zoom',
      joinUrl: 'https://zoom.example.com/j/999',
    });

    const first = await createDueLiveSessionReminders(new Date('2030-01-01T10:00:00Z'));
    expect(first.created).toBe(1);

    const duplicate = await createDueLiveSessionReminders(new Date('2030-01-01T10:01:00Z'));
    expect(duplicate.created).toBe(0);

    const second = await createDueLiveSessionReminders(new Date('2030-01-02T09:45:00Z'));
    expect(second.created).toBe(1);

    const reminders = await NotificationModel.find({
      userId: student.userId,
      type: 'live_session_reminder',
    }).sort({ createdAt: 1 });
    expect(reminders).toHaveLength(2);
    expect(reminders[0]!.actionUrl).toBe(`/live/${courseId}`);
  });
});
