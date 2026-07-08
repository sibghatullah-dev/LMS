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
  createLiveBreakoutRooms,
  ingestProviderLiveSessionReport,
  launchLivePoll,
  listLiveChatMessages,
  listLiveBreakoutRooms,
  listLiveSessions,
  listLivePolls,
  listLiveWhiteboardEvents,
  listSessionAttendance,
  markNativeRecordingAvailable,
  markNativeRecordingFailed,
  overrideAttendance,
  recordNativeAttendanceJoin,
  recordNativeAttendanceLeave,
  recallLiveBreakoutRooms,
  respondToLivePoll,
  scheduleLiveSession,
  sendLiveChatMessage,
  addLiveWhiteboardEvent,
  startLiveSession,
} from '../src/services/live-session.service';
import { createDueLiveSessionReminders } from '../src/services/notification.service';
import type { AuthContext } from '../src/rbac/roles';

let seq = 0;

async function makeInstitution(slug: string) {
  const inst = await InstitutionModel.create({ name: slug, slug });
  return String(inst._id);
}

async function makeInstitutionWithNativeLiveFlag(slug: string, enabled: boolean) {
  const inst = await InstitutionModel.create({
    name: slug,
    slug,
    featureFlags: { nativeLiveClassroom: enabled },
  });
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

  it('requires provider credentials when no external meeting link is supplied', async () => {
    await expect(
      scheduleLiveSession(instructor, courseId, {
        title: 'Credential-backed Zoom',
        scheduledStart: new Date('2030-01-01T10:00:00Z'),
        scheduledEnd: new Date('2030-01-01T11:00:00Z'),
        deliveryMode: 'zoom',
      }),
    ).rejects.toMatchObject({ httpStatus: 400 });
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
    expect(token.mediaServiceUrl).toBe('http://localhost:3010');
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

  it('derives native attendance from join and leave timestamps', async () => {
    const session = await scheduleLiveSession(instructor, courseId, {
      title: 'Native attendance',
      scheduledStart: new Date('2030-01-01T10:00:00Z'),
      scheduledEnd: new Date('2030-01-01T11:00:00Z'),
      deliveryMode: 'native',
    });
    await recordNativeAttendanceJoin(student, session.id);
    const left = await recordNativeAttendanceLeave(student, session.id);
    expect(left.source).toBe('native');
    expect(left.present).toBe(true);
    expect(left.leftAt).toBeTruthy();
  });

  it('ingests provider recording metadata and attendance by enrolled email', async () => {
    const session = await scheduleLiveSession(instructor, courseId, {
      title: 'Provider session',
      scheduledStart: new Date('2030-01-01T10:00:00Z'),
      scheduledEnd: new Date('2030-01-01T11:00:00Z'),
      deliveryMode: 'zoom',
      joinUrl: 'https://zoom.example.com/j/123',
    });

    const studentDoc = await UserModel.findById(student.userId).lean();
    const result = await ingestProviderLiveSessionReport(instructor, session.id, {
      providerMeetingId: 'zoom-123',
      recordingUrl: 'https://zoom.example.com/recording/123',
      recordingDurationSeconds: 3600,
      attendees: [
        {
          email: studentDoc!.email,
          joinedAt: new Date('2030-01-01T10:00:00Z'),
          leftAt: new Date('2030-01-01T10:45:00Z'),
          durationSeconds: 2700,
        },
      ],
    });

    expect(result.session.providerRecordingUrl).toBe('https://zoom.example.com/recording/123');
    expect(result.attendanceUpdated).toBe(1);

    const attendance = await listSessionAttendance(instructor, session.id);
    expect(attendance[0]!.source).toBe('provider');
    expect(attendance[0]!.durationSeconds).toBe(2700);
    expect(attendance[0]!.present).toBe(true);
  });

  it('launches native polls and aggregates one response per participant', async () => {
    const session = await scheduleLiveSession(instructor, courseId, {
      title: 'Poll session',
      scheduledStart: new Date('2030-01-01T10:00:00Z'),
      scheduledEnd: new Date('2030-01-01T11:00:00Z'),
      deliveryMode: 'native',
    });
    await expect(
      launchLivePoll(instructor, session.id, { question: 'Ready?', options: ['Yes', 'No'] }),
    ).rejects.toMatchObject({ httpStatus: 400 });

    await startLiveSession(instructor, session.id);
    const poll = await launchLivePoll(instructor, session.id, {
      question: 'Ready?',
      options: ['Yes', 'No'],
    });
    expect(poll.counts).toEqual([0, 0]);

    const answered = await respondToLivePoll(student, poll.id, { optionIndex: 0 });
    expect(answered.counts).toEqual([1, 0]);
    const changed = await respondToLivePoll(student, poll.id, { optionIndex: 1 });
    expect(changed.counts).toEqual([0, 1]);

    const listed = await listLivePolls(student, session.id);
    expect(listed[0]!.responseCount).toBe(1);
  });

  it('supports native in-session text chat for enrolled participants and staff', async () => {
    const session = await scheduleLiveSession(instructor, courseId, {
      title: 'Chat session',
      scheduledStart: new Date('2030-01-01T10:00:00Z'),
      scheduledEnd: new Date('2030-01-01T11:00:00Z'),
      deliveryMode: 'native',
    });

    await sendLiveChatMessage(instructor, session.id, { body: 'Welcome to class.' });
    const studentMessage = await sendLiveChatMessage(student, session.id, { body: 'Hello!' });
    expect(studentMessage.body).toBe('Hello!');

    const messages = await listLiveChatMessages(student, session.id);
    expect(messages.map((message) => message.body)).toEqual(['Welcome to class.', 'Hello!']);

    const external = await scheduleLiveSession(instructor, courseId, {
      title: 'External session',
      scheduledStart: new Date('2030-01-02T10:00:00Z'),
      scheduledEnd: new Date('2030-01-02T11:00:00Z'),
      deliveryMode: 'zoom',
      joinUrl: 'https://zoom.example.com/j/123',
    });
    await expect(sendLiveChatMessage(student, external.id, { body: 'Nope' })).rejects.toMatchObject({
      httpStatus: 400,
    });
  });

  it('persists native whiteboard stroke and clear events for enrolled participants', async () => {
    const session = await scheduleLiveSession(instructor, courseId, {
      title: 'Whiteboard session',
      scheduledStart: new Date('2030-01-01T10:00:00Z'),
      scheduledEnd: new Date('2030-01-01T11:00:00Z'),
      deliveryMode: 'native',
    });

    await addLiveWhiteboardEvent(instructor, session.id, {
      kind: 'stroke',
      color: '#111827',
      width: 3,
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.4, y: 0.5 },
      ],
    });
    await addLiveWhiteboardEvent(instructor, session.id, { kind: 'clear' });

    const events = await listLiveWhiteboardEvents(student, session.id);
    expect(events.map((event) => event.kind)).toEqual(['stroke', 'clear']);
    expect(events[0]!.points).toHaveLength(2);

    await expect(
      addLiveWhiteboardEvent(student, session.id, {
        kind: 'stroke',
        color: '#111827',
        width: 3,
        points: [
          { x: 0.1, y: 0.2 },
          { x: 0.4, y: 0.5 },
        ],
      }),
    ).rejects.toMatchObject({ httpStatus: 403 });
  });

  it('creates and recalls native breakout rooms with enrolled participant validation', async () => {
    const session = await scheduleLiveSession(instructor, courseId, {
      title: 'Breakout session',
      scheduledStart: new Date('2030-01-01T10:00:00Z'),
      scheduledEnd: new Date('2030-01-01T11:00:00Z'),
      deliveryMode: 'native',
    });
    const rooms = await createLiveBreakoutRooms(instructor, session.id, {
      rooms: [{ name: 'Room A', participantIds: [student.userId] }],
    });
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.participantIds).toEqual([student.userId]);

    const visible = await listLiveBreakoutRooms(student, session.id);
    expect(visible[0]!.name).toBe('Room A');

    const outsider = await makeUser(institutionId, 'student');
    await expect(
      createLiveBreakoutRooms(instructor, session.id, {
        rooms: [{ name: 'Room B', participantIds: [outsider.userId] }],
      }),
    ).rejects.toMatchObject({ httpStatus: 400 });

    const recalled = await recallLiveBreakoutRooms(instructor, session.id);
    expect(recalled.recalled).toBe(1);
    const afterRecall = await listLiveBreakoutRooms(student, session.id);
    expect(afterRecall[0]!.recalledAt).toBeTruthy();
  });

  it('tracks native recording processing, availability, and failure states', async () => {
    const session = await scheduleLiveSession(instructor, courseId, {
      title: 'Recording session',
      scheduledStart: new Date('2030-01-01T10:00:00Z'),
      scheduledEnd: new Date('2030-01-01T11:00:00Z'),
      deliveryMode: 'native',
    });
    const live = await startLiveSession(instructor, session.id);
    expect(live.recordingStatus).toBe('processing');

    const available = await markNativeRecordingAvailable(instructor, session.id, {
      storageKey: 'recordings/session.mp4',
      durationSeconds: 3600,
    });
    expect(available.recordingStatus).toBe('available');
    expect(available.recordingStorageKey).toBe('recordings/session.mp4');

    const failed = await markNativeRecordingFailed(instructor, session.id, {
      error: 'Transcode failed',
    });
    expect(failed.recordingStatus).toBe('failed');
    expect(failed.recordingError).toBe('Transcode failed');
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

  it('blocks native sessions when the tenant disables the feature flag', async () => {
    const disabledInstitutionId = await makeInstitutionWithNativeLiveFlag('no-native', false);
    const disabledInstructor = await makeUser(disabledInstitutionId, 'instructor');
    const disabledCourse = await makeCourse(disabledInstitutionId, disabledInstructor.userId);

    await expect(
      scheduleLiveSession(disabledInstructor, disabledCourse, {
        title: 'Flagged off',
        scheduledStart: new Date('2030-01-01T10:00:00Z'),
        scheduledEnd: new Date('2030-01-01T11:00:00Z'),
        deliveryMode: 'native',
      }),
    ).rejects.toMatchObject({ httpStatus: 400 });
  });
});
