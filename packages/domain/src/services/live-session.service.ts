import mongoose, { type HydratedDocument } from 'mongoose';
import { SignJWT } from 'jose';
import { loadEnv } from '@lumora/config';
import { AttendanceModel, CourseModel, EnrollmentModel, LiveSessionModel } from '../models';
import type { Attendance } from '../models/attendance.model';
import type { Course } from '../models/course.model';
import type { LiveSession } from '../models/live-session.model';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { hasAnyRole, type AuthContext } from '../rbac/roles';
import type {
  AttendanceOverrideInput,
  LiveSessionCreateInput,
} from '../schemas/live-session.schema';
import { writeAudit } from './audit.service';

const { Types } = mongoose;

type CourseDoc = HydratedDocument<Course>;
type LiveSessionDoc = HydratedDocument<LiveSession>;
type AttendanceDoc = HydratedDocument<Attendance>;

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
    startedAt: session.startedAt?.toISOString(),
    endedAt: session.endedAt?.toISOString(),
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

  const session = await LiveSessionModel.create({
    institutionId: ctx.institutionId,
    courseId,
    instructorId: course.instructorId,
    title: input.title,
    description: input.description ?? '',
    scheduledStart: input.scheduledStart,
    scheduledEnd: input.scheduledEnd,
    deliveryMode: input.deliveryMode,
    joinUrl: input.joinUrl,
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

export async function startLiveSession(
  ctx: AuthContext,
  sessionId: string,
): Promise<PublicLiveSession> {
  const session = await loadSession(ctx, sessionId);
  const course = await loadCourse(ctx, String(session.courseId));
  assertCanManageCourse(ctx, course);
  if (session.status === 'ended' || session.status === 'cancelled') {
    throw ValidationError('This live session can no longer be started.');
  }
  session.status = 'live';
  session.startedAt = new Date();
  await session.save();
  return toLiveSession(session);
}

export async function endLiveSession(
  ctx: AuthContext,
  sessionId: string,
): Promise<PublicLiveSession> {
  const session = await loadSession(ctx, sessionId);
  const course = await loadCourse(ctx, String(session.courseId));
  assertCanManageCourse(ctx, course);
  if (session.status === 'ended') return toLiveSession(session);
  session.status = 'ended';
  session.endedAt = new Date();
  await session.save();
  return toLiveSession(session);
}

export async function createLiveSessionJoinToken(
  ctx: AuthContext,
  sessionId: string,
): Promise<{ joinToken: string; mediaServiceUrl: string; joinUrl?: string }> {
  const session = await loadSession(ctx, sessionId);
  const course = await loadCourse(ctx, String(session.courseId));
  await assertCanViewCourseSessions(ctx, course);

  if (session.deliveryMode !== 'native') {
    return {
      joinToken: '',
      mediaServiceUrl: '',
      joinUrl: session.joinUrl ?? undefined,
    };
  }

  const { NEXTAUTH_SECRET, APP_URL } = loadEnv();
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

  return { joinToken, mediaServiceUrl: APP_URL };
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
