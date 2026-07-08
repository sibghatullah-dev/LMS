import mongoose, { type HydratedDocument } from 'mongoose';
import { SignJWT } from 'jose';
import { loadEnv } from '@lumora/config';
import {
  AttendanceModel,
  CourseModel,
  EnrollmentModel,
  InstitutionModel,
  LiveBreakoutRoomModel,
  LiveChatMessageModel,
  LivePollModel,
  LiveSessionModel,
  LiveWhiteboardEventModel,
  UserModel,
} from '../models';
import type { Attendance } from '../models/attendance.model';
import type { Course } from '../models/course.model';
import type { LiveBreakoutRoom } from '../models/live-breakout-room.model';
import type { LiveChatMessage } from '../models/live-chat-message.model';
import type { LivePoll } from '../models/live-poll.model';
import type { LiveSession } from '../models/live-session.model';
import type { LiveWhiteboardEvent } from '../models/live-whiteboard-event.model';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { hasAnyRole, type AuthContext } from '../rbac/roles';
import type {
  AttendanceOverrideInput,
  LiveBreakoutRoomCreateInput,
  LiveChatMessageCreateInput,
  LivePollCreateInput,
  LivePollResponseInput,
  LiveSessionCreateInput,
  NativeRecordingCompleteInput,
  NativeRecordingFailedInput,
  LiveWhiteboardEventCreateInput,
  ProviderAttendanceReportInput,
} from '../schemas/live-session.schema';
import { writeAudit } from './audit.service';

const { Types } = mongoose;

type CourseDoc = HydratedDocument<Course>;
type LiveSessionDoc = HydratedDocument<LiveSession>;
type AttendanceDoc = HydratedDocument<Attendance>;
type LiveBreakoutRoomDoc = HydratedDocument<LiveBreakoutRoom>;
type LivePollDoc = HydratedDocument<LivePoll>;
type LiveChatMessageDoc = HydratedDocument<LiveChatMessage>;
type LiveWhiteboardEventDoc = HydratedDocument<LiveWhiteboardEvent>;

async function assertNativeLiveEnabled(institutionId: string): Promise<void> {
  const institution = await InstitutionModel.findById(institutionId).select('featureFlags.nativeLiveClassroom');
  if (institution?.featureFlags?.nativeLiveClassroom === false) {
    throw ValidationError('Native live classroom is disabled for this institution.');
  }
}

async function notifyMediaService(
  path: string,
  body: Record<string, unknown> = {},
): Promise<void> {
  const { MEDIA_SERVICE_URL } = loadEnv();
  const url = new URL(path, MEDIA_SERVICE_URL);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Native classroom should degrade gracefully if the auxiliary media service is unreachable.
  }
}

export interface PublicLiveSession {
  id: string;
  courseId: string;
  instructorId: string;
  title: string;
  description: string;
  scheduledStart: string;
  scheduledEnd: string;
  deliveryMode: LiveSession['deliveryMode'];
  status: LiveSession['status'];
  joinUrl?: string;
  providerMeetingId?: string;
  providerRecordingUrl?: string;
  recordingStorageKey?: string;
  recordingDurationSeconds?: number;
  recordingStatus?: LiveSession['recordingStatus'];
  recordingError?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface PublicAttendanceRecord {
  id: string;
  courseId: string;
  liveSessionId: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  joinedAt?: string;
  leftAt?: string;
  durationSeconds: number;
  present: boolean;
  source: Attendance['source'];
  overrideReason?: string;
}

export interface PublicLivePoll {
  id: string;
  liveSessionId: string;
  question: string;
  options: string[];
  counts: number[];
  responseCount: number;
  closedAt?: string;
  createdAt?: string;
}

export interface PublicLiveChatMessage {
  id: string;
  liveSessionId: string;
  senderId: string;
  senderName?: string;
  senderRole?: string;
  body: string;
  createdAt?: string;
}

export interface PublicLiveWhiteboardEvent {
  id: string;
  liveSessionId: string;
  kind: 'stroke' | 'clear';
  color?: string;
  width?: number;
  points: { x: number; y: number }[];
  createdBy: string;
  createdAt?: string;
}

export interface PublicLiveBreakoutRoom {
  id: string;
  liveSessionId: string;
  name: string;
  participantIds: string[];
  recalledAt?: string;
}

function toLiveSession(session: LiveSessionDoc): PublicLiveSession {
  return {
    id: String(session._id),
    courseId: String(session.courseId),
    instructorId: String(session.instructorId),
    title: session.title,
    description: session.description ?? '',
    scheduledStart: session.scheduledStart.toISOString(),
    scheduledEnd: session.scheduledEnd.toISOString(),
    deliveryMode: session.deliveryMode,
    status: session.status,
    joinUrl: session.joinUrl ?? undefined,
    providerMeetingId: session.providerMeetingId ?? undefined,
    providerRecordingUrl: session.providerRecordingUrl ?? undefined,
    recordingStorageKey: session.recordingStorageKey ?? undefined,
    recordingDurationSeconds: session.recordingDurationSeconds ?? undefined,
    recordingStatus: session.recordingStatus ?? undefined,
    recordingError: session.recordingError ?? undefined,
    startedAt: session.startedAt?.toISOString(),
    endedAt: session.endedAt?.toISOString(),
  };
}

function toLivePoll(poll: LivePollDoc): PublicLivePoll {
  const counts = poll.options.map(() => 0);
  for (const response of poll.responses ?? []) {
    if (response.optionIndex >= 0 && response.optionIndex < counts.length) {
      counts[response.optionIndex] = (counts[response.optionIndex] ?? 0) + 1;
    }
  }
  return {
    id: String(poll._id),
    liveSessionId: String(poll.liveSessionId),
    question: poll.question,
    options: poll.options,
    counts,
    responseCount: poll.responses?.length ?? 0,
    closedAt: poll.closedAt?.toISOString(),
    createdAt: poll.createdAt?.toISOString(),
  };
}

function toLiveChatMessage(message: LiveChatMessageDoc): PublicLiveChatMessage {
  const sender = message.populated('senderId')
    ? (message.senderId as unknown as { _id: unknown; fullName?: string; role?: string })
    : null;
  return {
    id: String(message._id),
    liveSessionId: String(message.liveSessionId),
    senderId: String(sender?._id ?? message.senderId),
    senderName: sender?.fullName,
    senderRole: sender?.role,
    body: message.body,
    createdAt: message.createdAt?.toISOString(),
  };
}

function toLiveWhiteboardEvent(event: LiveWhiteboardEventDoc): PublicLiveWhiteboardEvent {
  return {
    id: String(event._id),
    liveSessionId: String(event.liveSessionId),
    kind: event.kind,
    color: event.color ?? undefined,
    width: event.width ?? undefined,
    points: (event.points ?? []).map((point) => ({ x: point.x, y: point.y })),
    createdBy: String(event.createdBy),
    createdAt: event.createdAt?.toISOString(),
  };
}

function toLiveBreakoutRoom(room: LiveBreakoutRoomDoc): PublicLiveBreakoutRoom {
  return {
    id: String(room._id),
    liveSessionId: String(room.liveSessionId),
    name: room.name,
    participantIds: (room.participantIds ?? []).map(String),
    recalledAt: room.recalledAt?.toISOString(),
  };
}

function toAttendance(record: AttendanceDoc): PublicAttendanceRecord {
  const student = record.populated('studentId')
    ? (record.studentId as unknown as { _id: unknown; fullName?: string; email?: string })
    : null;
  return {
    id: String(record._id),
    courseId: String(record.courseId),
    liveSessionId: String(record.liveSessionId),
    studentId: String(student?._id ?? record.studentId),
    studentName: student?.fullName,
    studentEmail: student?.email,
    joinedAt: record.joinedAt?.toISOString(),
    leftAt: record.leftAt?.toISOString(),
    durationSeconds: record.durationSeconds ?? 0,
    present: record.present ?? false,
    source: record.source,
    overrideReason: record.overrideReason ?? undefined,
  };
}

const isManager = (ctx: AuthContext) => hasAnyRole(ctx.role, ['admin', 'super_admin']);

async function loadCourse(ctx: AuthContext, courseId: string): Promise<CourseDoc> {
  if (!Types.ObjectId.isValid(courseId)) throw NotFoundError('Course not found.');
  const course = await CourseModel.findOne({ _id: courseId, institutionId: ctx.institutionId });
  if (!course) throw NotFoundError('Course not found.');
  return course;
}

function assertCanManageCourse(ctx: AuthContext, course: CourseDoc): void {
  if (isManager(ctx) || String(course.instructorId) === ctx.userId) return;
  throw ForbiddenError('You do not manage this course.');
}

async function assertCanViewCourseSessions(ctx: AuthContext, course: CourseDoc): Promise<void> {
  if (isManager(ctx) || String(course.instructorId) === ctx.userId) return;

  const enrollment = await EnrollmentModel.exists({
    institutionId: ctx.institutionId,
    courseId: course._id,
    studentId: ctx.userId,
    status: { $in: ['active', 'completed'] },
  });
  if (!enrollment) throw ForbiddenError('You are not enrolled in this course.');
}

async function loadSession(ctx: AuthContext, sessionId: string): Promise<LiveSessionDoc> {
  if (!Types.ObjectId.isValid(sessionId)) throw NotFoundError('Live session not found.');
  const session = await LiveSessionModel.findOne({
    _id: sessionId,
    institutionId: ctx.institutionId,
  });
  if (!session) throw NotFoundError('Live session not found.');
  return session;
}

async function assertEnrolledForSession(ctx: AuthContext, session: LiveSessionDoc): Promise<void> {
  const course = await loadCourse(ctx, String(session.courseId));
  await assertCanViewCourseSessions(ctx, course);
}

async function createAttendancePlaceholders(session: LiveSessionDoc): Promise<void> {
  const enrollments = await EnrollmentModel.find({
    institutionId: session.institutionId,
    courseId: session.courseId,
    status: { $in: ['active', 'completed'] },
  }).select('studentId');

  if (enrollments.length === 0) return;

  await AttendanceModel.bulkWrite(
    enrollments.map((enrollment) => ({
      updateOne: {
        filter: { liveSessionId: session._id, studentId: enrollment.studentId },
        update: {
          $setOnInsert: {
            institutionId: session.institutionId,
            courseId: session.courseId,
            liveSessionId: session._id,
            studentId: enrollment.studentId,
            present: false,
            durationSeconds: 0,
            source: 'manual',
          },
        },
        upsert: true,
      },
    })),
  );
}

export async function listLiveSessions(
  ctx: AuthContext,
  courseId: string,
): Promise<PublicLiveSession[]> {
  const course = await loadCourse(ctx, courseId);
  await assertCanViewCourseSessions(ctx, course);

  const sessions = await LiveSessionModel.find({
    institutionId: ctx.institutionId,
    courseId,
  }).sort({ scheduledStart: 1 });
  return sessions.map(toLiveSession);
}

export async function scheduleLiveSession(
  ctx: AuthContext,
  courseId: string,
  input: LiveSessionCreateInput,
): Promise<PublicLiveSession> {
  const course = await loadCourse(ctx, courseId);
  assertCanManageCourse(ctx, course);
  if (input.deliveryMode === 'native') await assertNativeLiveEnabled(ctx.institutionId);
  const providerMeeting =
    input.deliveryMode === 'native'
      ? null
      : input.joinUrl
        ? { joinUrl: input.joinUrl, providerMeetingId: undefined }
        : await createProviderMeeting(input);

  const session = await LiveSessionModel.create({
    institutionId: ctx.institutionId,
    courseId,
    instructorId: course.instructorId,
    title: input.title,
    description: input.description ?? '',
    scheduledStart: input.scheduledStart,
    scheduledEnd: input.scheduledEnd,
    deliveryMode: input.deliveryMode,
    joinUrl: providerMeeting?.joinUrl,
    providerMeetingId: providerMeeting?.providerMeetingId,
    status: 'scheduled',
  });

  await createAttendancePlaceholders(session);
  await writeAudit({
    institutionId: ctx.institutionId,
    actorId: ctx.userId,
    actorRole: ctx.role,
    action: 'live_session.schedule',
    targetEntity: { type: 'live_session', id: session._id },
    after: {
      courseId,
      title: input.title,
      deliveryMode: input.deliveryMode,
      scheduledStart: input.scheduledStart,
    },
  });

  return toLiveSession(session);
}

async function createProviderMeeting(input: LiveSessionCreateInput): Promise<{
  joinUrl: string;
  providerMeetingId?: string;
}> {
  if (input.deliveryMode === 'zoom') return createZoomMeeting(input);
  if (input.deliveryMode === 'ms_teams') return createTeamsMeeting(input);
  throw ValidationError('Unsupported provider meeting mode.');
}

async function createZoomMeeting(input: LiveSessionCreateInput): Promise<{
  joinUrl: string;
  providerMeetingId?: string;
}> {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = loadEnv();
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw ValidationError('Zoom credentials are not configured. Provide a meeting link or configure Zoom.');
  }
  const tokenRes = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(
      ZOOM_ACCOUNT_ID,
    )}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')}`,
      },
    },
  );
  if (!tokenRes.ok) throw ValidationError('Zoom meeting creation failed during token exchange.');
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw ValidationError('Zoom did not return an access token.');

  const meetingRes = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: input.title,
      type: 2,
      start_time: input.scheduledStart.toISOString(),
      duration: Math.max(1, Math.ceil((input.scheduledEnd.getTime() - input.scheduledStart.getTime()) / 60_000)),
      agenda: input.description,
      settings: {
        join_before_host: false,
        waiting_room: true,
        auto_recording: 'cloud',
      },
    }),
  });
  if (!meetingRes.ok) throw ValidationError('Zoom meeting creation failed.');
  const meeting = (await meetingRes.json()) as { id?: string | number; join_url?: string };
  if (!meeting.join_url) throw ValidationError('Zoom did not return a join URL.');
  return { joinUrl: meeting.join_url, providerMeetingId: String(meeting.id ?? '') || undefined };
}

async function createTeamsMeeting(input: LiveSessionCreateInput): Promise<{
  joinUrl: string;
  providerMeetingId?: string;
}> {
  const {
    MS_TEAMS_CLIENT_ID,
    MS_TEAMS_CLIENT_SECRET,
    MS_TEAMS_TENANT_ID,
    MS_TEAMS_ORGANIZER_USER_ID,
  } = loadEnv();
  if (
    !MS_TEAMS_CLIENT_ID ||
    !MS_TEAMS_CLIENT_SECRET ||
    !MS_TEAMS_TENANT_ID ||
    !MS_TEAMS_ORGANIZER_USER_ID
  ) {
    throw ValidationError('MS Teams credentials are not configured. Provide a meeting link or configure Teams.');
  }

  const body = new URLSearchParams({
    client_id: MS_TEAMS_CLIENT_ID,
    client_secret: MS_TEAMS_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(MS_TEAMS_TENANT_ID)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  );
  if (!tokenRes.ok) throw ValidationError('MS Teams meeting creation failed during token exchange.');
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw ValidationError('MS Teams did not return an access token.');

  const meetingRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MS_TEAMS_ORGANIZER_USER_ID)}/onlineMeetings`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: input.title,
        startDateTime: input.scheduledStart.toISOString(),
        endDateTime: input.scheduledEnd.toISOString(),
      }),
    },
  );
  if (!meetingRes.ok) throw ValidationError('MS Teams meeting creation failed.');
  const meeting = (await meetingRes.json()) as { id?: string; joinWebUrl?: string };
  if (!meeting.joinWebUrl) throw ValidationError('MS Teams did not return a join URL.');
  return { joinUrl: meeting.joinWebUrl, providerMeetingId: meeting.id };
}

export async function startLiveSession(
  ctx: AuthContext,
  sessionId: string,
): Promise<PublicLiveSession> {
  const session = await loadSession(ctx, sessionId);
  const course = await loadCourse(ctx, String(session.courseId));
  assertCanManageCourse(ctx, course);
  if (session.deliveryMode === 'native') await assertNativeLiveEnabled(ctx.institutionId);
  if (session.status === 'ended' || session.status === 'cancelled') {
    throw ValidationError('This live session can no longer be started.');
  }
  session.status = 'live';
  session.startedAt = new Date();
  if (session.deliveryMode === 'native') session.recordingStatus = 'processing';
  await session.save();
  if (session.deliveryMode === 'native') {
    void notifyMediaService(`/rooms/${encodeURIComponent(String(session._id))}/start`, {
      institutionId: ctx.institutionId,
      courseId: String(session.courseId),
      title: session.title,
      deliveryMode: session.deliveryMode,
      recordingStatus: 'recording',
    });
  }
  return toLiveSession(session);
}

export async function endLiveSession(
  ctx: AuthContext,
  sessionId: string,
): Promise<PublicLiveSession> {
  const session = await loadSession(ctx, sessionId);
  const course = await loadCourse(ctx, String(session.courseId));
  assertCanManageCourse(ctx, course);
  if (session.deliveryMode === 'native') await assertNativeLiveEnabled(ctx.institutionId);
  if (session.status === 'ended') return toLiveSession(session);
  session.status = 'ended';
  session.endedAt = new Date();
  if (session.deliveryMode === 'native' && session.recordingStatus === 'not_available') {
    session.recordingStatus = 'processing';
  }
  await session.save();
  if (session.deliveryMode === 'native') {
    void notifyMediaService(`/rooms/${encodeURIComponent(String(session._id))}/end`, {
      institutionId: ctx.institutionId,
      courseId: String(session.courseId),
      title: session.title,
      deliveryMode: session.deliveryMode,
    });
  }
  return toLiveSession(session);
}

export async function markNativeRecordingAvailable(
  ctx: AuthContext,
  sessionId: string,
  input: NativeRecordingCompleteInput,
): Promise<PublicLiveSession> {
  const session = await loadSession(ctx, sessionId);
  const course = await loadCourse(ctx, String(session.courseId));
  assertCanManageCourse(ctx, course);
  if (session.deliveryMode !== 'native') throw ValidationError('Native recording applies only to native sessions.');
  await assertNativeLiveEnabled(ctx.institutionId);

  session.recordingStatus = 'available';
  session.recordingStorageKey = input.storageKey;
  session.recordingDurationSeconds = input.durationSeconds;
  session.recordingError = undefined;
  await session.save();
  void notifyMediaService(`/rooms/${encodeURIComponent(String(session._id))}/recording`, {
    status: 'available',
    storageKey: input.storageKey,
    durationSeconds: input.durationSeconds,
  });
  return toLiveSession(session);
}

export async function markNativeRecordingFailed(
  ctx: AuthContext,
  sessionId: string,
  input: NativeRecordingFailedInput,
): Promise<PublicLiveSession> {
  const session = await loadSession(ctx, sessionId);
  const course = await loadCourse(ctx, String(session.courseId));
  assertCanManageCourse(ctx, course);
  if (session.deliveryMode !== 'native') throw ValidationError('Native recording applies only to native sessions.');
  await assertNativeLiveEnabled(ctx.institutionId);

  session.recordingStatus = 'failed';
  session.recordingError = input.error;
  await session.save();
  void notifyMediaService(`/rooms/${encodeURIComponent(String(session._id))}/recording`, {
    status: 'failed',
    error: input.error,
  });
  return toLiveSession(session);
}

export async function createLiveSessionJoinToken(
  ctx: AuthContext,
  sessionId: string,
): Promise<{ joinToken: string; mediaServiceUrl: string; joinUrl?: string }> {
  const session = await loadSession(ctx, sessionId);
  const course = await loadCourse(ctx, String(session.courseId));
  await assertCanViewCourseSessions(ctx, course);
  if (session.deliveryMode === 'native') await assertNativeLiveEnabled(ctx.institutionId);

  if (session.deliveryMode !== 'native') {
    return {
      joinToken: '',
      mediaServiceUrl: '',
      joinUrl: session.joinUrl ?? undefined,
    };
  }

  const { NEXTAUTH_SECRET, MEDIA_SERVICE_URL } = loadEnv();
  const joinToken = await new SignJWT({
    type: 'live_session_join',
    institutionId: ctx.institutionId,
    courseId: String(session.courseId),
    sessionId: String(session._id),
    role: ctx.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(ctx.userId)
    .setIssuer('lumora')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(NEXTAUTH_SECRET));

  return { joinToken, mediaServiceUrl: MEDIA_SERVICE_URL };
}

export async function recordNativeAttendanceJoin(
  ctx: AuthContext,
  sessionId: string,
): Promise<PublicAttendanceRecord> {
  const session = await loadSession(ctx, sessionId);
  if (session.deliveryMode !== 'native') throw ValidationError('Attendance join is only for native sessions.');
  await assertNativeLiveEnabled(ctx.institutionId);
  if (session.status === 'ended' || session.status === 'cancelled') {
    throw ValidationError('This live session is not joinable.');
  }
  await assertEnrolledForSession(ctx, session);

  const now = new Date();
  const record = await AttendanceModel.findOneAndUpdate(
    {
      institutionId: ctx.institutionId,
      liveSessionId: session._id,
      studentId: ctx.userId,
    },
    {
      $setOnInsert: {
        courseId: session.courseId,
        joinedAt: now,
      },
      $set: {
        source: 'native',
      },
    },
    { upsert: true, new: true },
  );
  if (!record.joinedAt) {
    record.joinedAt = now;
    await record.save();
  }
  await record.populate('studentId', 'fullName email');
  return toAttendance(record);
}

export async function recordNativeAttendanceLeave(
  ctx: AuthContext,
  sessionId: string,
): Promise<PublicAttendanceRecord> {
  const session = await loadSession(ctx, sessionId);
  if (session.deliveryMode !== 'native') throw ValidationError('Attendance leave is only for native sessions.');
  await assertNativeLiveEnabled(ctx.institutionId);
  await assertEnrolledForSession(ctx, session);

  const now = new Date();
  const record = await AttendanceModel.findOneAndUpdate(
    {
      institutionId: ctx.institutionId,
      liveSessionId: session._id,
      studentId: ctx.userId,
    },
    {
      $setOnInsert: {
        courseId: session.courseId,
        joinedAt: now,
      },
      $set: {
        leftAt: now,
        source: 'native',
      },
    },
    { upsert: true, new: true },
  );
  const durationSeconds = Math.max(
    0,
    Math.round((now.getTime() - (record.joinedAt ?? now).getTime()) / 1000),
  );
  record.durationSeconds = Math.max(record.durationSeconds ?? 0, durationSeconds);
  record.present = true;
  await record.save();
  await record.populate('studentId', 'fullName email');
  return toAttendance(record);
}

export async function ingestProviderLiveSessionReport(
  ctx: AuthContext,
  sessionId: string,
  input: ProviderAttendanceReportInput,
): Promise<{ session: PublicLiveSession; attendanceUpdated: number }> {
  const session = await loadSession(ctx, sessionId);
  const course = await loadCourse(ctx, String(session.courseId));
  assertCanManageCourse(ctx, course);
  if (session.deliveryMode === 'native') {
    throw ValidationError('Provider reports are only for Zoom or MS Teams sessions.');
  }

  if (input.providerMeetingId !== undefined) session.providerMeetingId = input.providerMeetingId;
  if (input.recordingUrl !== undefined) session.providerRecordingUrl = input.recordingUrl;
  if (input.recordingDurationSeconds !== undefined)
    session.recordingDurationSeconds = input.recordingDurationSeconds;
  await session.save();

  let attendanceUpdated = 0;
  for (const attendee of input.attendees) {
    const user = await UserModel.findOne({
      institutionId: ctx.institutionId,
      email: attendee.email.toLowerCase().trim(),
    }).select('_id');
    if (!user) continue;
    const enrolled = await EnrollmentModel.exists({
      institutionId: ctx.institutionId,
      courseId: session.courseId,
      studentId: user._id,
      status: { $in: ['active', 'completed'] },
    });
    if (!enrolled) continue;

    await AttendanceModel.findOneAndUpdate(
      {
        institutionId: ctx.institutionId,
        liveSessionId: session._id,
        studentId: user._id,
      },
      {
        $set: {
          courseId: session.courseId,
          joinedAt: attendee.joinedAt,
          leftAt: attendee.leftAt,
          durationSeconds: attendee.durationSeconds ?? 0,
          present: attendee.present ?? (attendee.durationSeconds ?? 0) > 0,
          source: 'provider',
        },
      },
      { upsert: true },
    );
    attendanceUpdated++;
  }

  await writeAudit({
    institutionId: ctx.institutionId,
    actorId: ctx.userId,
    actorRole: ctx.role,
    action: 'live_session.provider_report_ingest',
    targetEntity: { type: 'live_session', id: session._id },
    after: {
      providerMeetingId: session.providerMeetingId,
      recordingUrl: session.providerRecordingUrl,
      attendanceUpdated,
    },
  });

  return { session: toLiveSession(session), attendanceUpdated };
}

export async function listLivePolls(ctx: AuthContext, sessionId: string): Promise<PublicLivePoll[]> {
  const session = await loadSession(ctx, sessionId);
  await assertEnrolledForSession(ctx, session);
  if (session.deliveryMode === 'native') await assertNativeLiveEnabled(ctx.institutionId);
  const polls = await LivePollModel.find({
    institutionId: ctx.institutionId,
    liveSessionId: sessionId,
  }).sort({ createdAt: -1 });
  return polls.map((poll) => toLivePoll(poll as LivePollDoc));
}

export async function launchLivePoll(
  ctx: AuthContext,
  sessionId: string,
  input: LivePollCreateInput,
): Promise<PublicLivePoll> {
  const session = await loadSession(ctx, sessionId);
  const course = await loadCourse(ctx, String(session.courseId));
  assertCanManageCourse(ctx, course);
  if (session.deliveryMode !== 'native') throw ValidationError('Polls are only available in native sessions.');
  await assertNativeLiveEnabled(ctx.institutionId);
  if (session.status !== 'live') throw ValidationError('Polls can only be launched during a live session.');

  const poll = await LivePollModel.create({
    institutionId: ctx.institutionId,
    courseId: session.courseId,
    liveSessionId: session._id,
    createdBy: ctx.userId,
    question: input.question,
    options: input.options,
  });
  return toLivePoll(poll);
}

export async function respondToLivePoll(
  ctx: AuthContext,
  pollId: string,
  input: LivePollResponseInput,
): Promise<PublicLivePoll> {
  if (!Types.ObjectId.isValid(pollId)) throw NotFoundError('Live poll not found.');
  const poll = await LivePollModel.findOne({ _id: pollId, institutionId: ctx.institutionId });
  if (!poll) throw NotFoundError('Live poll not found.');
  if (poll.closedAt) throw ValidationError('This poll is closed.');
  if (input.optionIndex >= poll.options.length) throw ValidationError('Invalid poll option.');

  const session = await loadSession(ctx, String(poll.liveSessionId));
  await assertEnrolledForSession(ctx, session);

  poll.set('responses', [
    ...(poll.responses ?? []).filter((response) => String(response.userId) !== ctx.userId),
    { userId: new Types.ObjectId(ctx.userId), optionIndex: input.optionIndex, respondedAt: new Date() },
  ]);
  await poll.save();
  return toLivePoll(poll);
}

export async function listLiveChatMessages(
  ctx: AuthContext,
  sessionId: string,
): Promise<PublicLiveChatMessage[]> {
  const session = await loadSession(ctx, sessionId);
  await assertEnrolledForSession(ctx, session);
  if (session.deliveryMode !== 'native') throw ValidationError('Chat is only available in native sessions.');
  await assertNativeLiveEnabled(ctx.institutionId);

  const messages = await LiveChatMessageModel.find({
    institutionId: ctx.institutionId,
    liveSessionId: sessionId,
  })
    .sort({ createdAt: 1 })
    .limit(200)
    .populate('senderId', 'fullName role');
  return messages.map((message) => toLiveChatMessage(message as LiveChatMessageDoc));
}

export async function sendLiveChatMessage(
  ctx: AuthContext,
  sessionId: string,
  input: LiveChatMessageCreateInput,
): Promise<PublicLiveChatMessage> {
  const session = await loadSession(ctx, sessionId);
  await assertEnrolledForSession(ctx, session);
  if (session.deliveryMode !== 'native') throw ValidationError('Chat is only available in native sessions.');
  await assertNativeLiveEnabled(ctx.institutionId);
  if (session.status === 'ended' || session.status === 'cancelled') {
    throw ValidationError('This live session chat is closed.');
  }

  const message = await LiveChatMessageModel.create({
    institutionId: ctx.institutionId,
    courseId: session.courseId,
    liveSessionId: session._id,
    senderId: ctx.userId,
    body: input.body.trim(),
  });
  await message.populate('senderId', 'fullName role');
  return toLiveChatMessage(message);
}

export async function listLiveWhiteboardEvents(
  ctx: AuthContext,
  sessionId: string,
): Promise<PublicLiveWhiteboardEvent[]> {
  const session = await loadSession(ctx, sessionId);
  await assertEnrolledForSession(ctx, session);
  if (session.deliveryMode !== 'native') throw ValidationError('Whiteboard is only available in native sessions.');
  await assertNativeLiveEnabled(ctx.institutionId);

  const events = await LiveWhiteboardEventModel.find({
    institutionId: ctx.institutionId,
    liveSessionId: sessionId,
  })
    .sort({ createdAt: 1 })
    .limit(1000);
  return events.map((event) => toLiveWhiteboardEvent(event as LiveWhiteboardEventDoc));
}

export async function addLiveWhiteboardEvent(
  ctx: AuthContext,
  sessionId: string,
  input: LiveWhiteboardEventCreateInput,
): Promise<PublicLiveWhiteboardEvent> {
  const session = await loadSession(ctx, sessionId);
  const course = await loadCourse(ctx, String(session.courseId));
  assertCanManageCourse(ctx, course);
  if (session.deliveryMode !== 'native') throw ValidationError('Whiteboard is only available in native sessions.');
  await assertNativeLiveEnabled(ctx.institutionId);
  if (session.status === 'ended' || session.status === 'cancelled') {
    throw ValidationError('This live session whiteboard is closed.');
  }

  const event = await LiveWhiteboardEventModel.create({
    institutionId: ctx.institutionId,
    courseId: session.courseId,
    liveSessionId: session._id,
    createdBy: ctx.userId,
    kind: input.kind,
    color: input.kind === 'stroke' ? input.color : undefined,
    width: input.kind === 'stroke' ? input.width : undefined,
    points: input.kind === 'stroke' ? input.points : [],
  });
  return toLiveWhiteboardEvent(event);
}

export async function listLiveBreakoutRooms(
  ctx: AuthContext,
  sessionId: string,
): Promise<PublicLiveBreakoutRoom[]> {
  const session = await loadSession(ctx, sessionId);
  await assertEnrolledForSession(ctx, session);
  if (session.deliveryMode !== 'native') throw ValidationError('Breakouts are only available in native sessions.');
  await assertNativeLiveEnabled(ctx.institutionId);

  const rooms = await LiveBreakoutRoomModel.find({
    institutionId: ctx.institutionId,
    liveSessionId: sessionId,
  }).sort({ createdAt: 1 });
  return rooms.map((room) => toLiveBreakoutRoom(room as LiveBreakoutRoomDoc));
}

export async function createLiveBreakoutRooms(
  ctx: AuthContext,
  sessionId: string,
  input: LiveBreakoutRoomCreateInput,
): Promise<PublicLiveBreakoutRoom[]> {
  const session = await loadSession(ctx, sessionId);
  const course = await loadCourse(ctx, String(session.courseId));
  assertCanManageCourse(ctx, course);
  if (session.deliveryMode !== 'native') throw ValidationError('Breakouts are only available in native sessions.');
  await assertNativeLiveEnabled(ctx.institutionId);
  if (session.status === 'ended' || session.status === 'cancelled') {
    throw ValidationError('This live session is closed.');
  }

  const participantIds = [...new Set(input.rooms.flatMap((room) => room.participantIds))];
  if (participantIds.length > 0) {
    const enrolled = await EnrollmentModel.find({
      institutionId: ctx.institutionId,
      courseId: session.courseId,
      studentId: { $in: participantIds },
      status: { $in: ['active', 'completed'] },
    }).select('studentId');
    const enrolledIds = new Set(enrolled.map((enrollment) => String(enrollment.studentId)));
    const invalid = participantIds.filter((id) => !enrolledIds.has(id));
    if (invalid.length > 0) throw ValidationError('All breakout participants must be enrolled learners.');
  }

  await LiveBreakoutRoomModel.deleteMany({
    institutionId: ctx.institutionId,
    liveSessionId: session._id,
  });
  const docs = await LiveBreakoutRoomModel.insertMany(
    input.rooms.map((room) => ({
      institutionId: ctx.institutionId,
      courseId: session.courseId,
      liveSessionId: session._id,
      name: room.name,
      participantIds: room.participantIds.map((id) => new Types.ObjectId(id)),
    })),
  );
  return docs.map((room) => toLiveBreakoutRoom(room as unknown as LiveBreakoutRoomDoc));
}

export async function recallLiveBreakoutRooms(
  ctx: AuthContext,
  sessionId: string,
): Promise<{ recalled: number }> {
  const session = await loadSession(ctx, sessionId);
  const course = await loadCourse(ctx, String(session.courseId));
  assertCanManageCourse(ctx, course);
  const result = await LiveBreakoutRoomModel.updateMany(
    { institutionId: ctx.institutionId, liveSessionId: session._id, recalledAt: { $exists: false } },
    { $set: { recalledAt: new Date() } },
  );
  return { recalled: result.modifiedCount };
}

export async function listSessionAttendance(
  ctx: AuthContext,
  sessionId: string,
): Promise<PublicAttendanceRecord[]> {
  const session = await loadSession(ctx, sessionId);
  const course = await loadCourse(ctx, String(session.courseId));
  assertCanManageCourse(ctx, course);
  await createAttendancePlaceholders(session);

  const records = await AttendanceModel.find({
    institutionId: ctx.institutionId,
    liveSessionId: sessionId,
  })
    .sort({ createdAt: 1 })
    .populate('studentId', 'fullName email');
  return records.map((record) => toAttendance(record as AttendanceDoc));
}

export async function overrideAttendance(
  ctx: AuthContext,
  attendanceId: string,
  input: AttendanceOverrideInput,
): Promise<PublicAttendanceRecord> {
  if (!Types.ObjectId.isValid(attendanceId)) throw NotFoundError('Attendance record not found.');
  const record = await AttendanceModel.findOne({
    _id: attendanceId,
    institutionId: ctx.institutionId,
  });
  if (!record) throw NotFoundError('Attendance record not found.');

  const session = await loadSession(ctx, String(record.liveSessionId));
  const course = await loadCourse(ctx, String(session.courseId));
  assertCanManageCourse(ctx, course);

  record.present = input.present;
  record.joinedAt = input.joinedAt;
  record.leftAt = input.leftAt;
  record.durationSeconds = input.durationSeconds ?? record.durationSeconds ?? 0;
  record.source = input.source;
  record.overrideReason = input.overrideReason;
  record.overriddenBy = new Types.ObjectId(ctx.userId);
  record.overriddenAt = new Date();
  await record.save();

  await writeAudit({
    institutionId: ctx.institutionId,
    actorId: ctx.userId,
    actorRole: ctx.role,
    action: 'attendance.override',
    targetEntity: { type: 'attendance', id: record._id },
    after: {
      liveSessionId: String(record.liveSessionId),
      studentId: String(record.studentId),
      present: record.present,
      reason: input.overrideReason,
    },
  });

  await record.populate('studentId', 'fullName email');
  return toAttendance(record);
}
