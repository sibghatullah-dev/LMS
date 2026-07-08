import { z } from 'zod';
import { ATTENDANCE_SOURCES, LIVE_SESSION_DELIVERY_MODES } from '@lumora/config';

export const liveSessionCreateSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    scheduledStart: z.coerce.date(),
    scheduledEnd: z.coerce.date(),
    deliveryMode: z.enum(LIVE_SESSION_DELIVERY_MODES),
    joinUrl: z.string().url().optional(),
  })
  .refine((input) => input.scheduledEnd > input.scheduledStart, {
    message: 'Session end must be after start.',
    path: ['scheduledEnd'],
  });
export type LiveSessionCreateInput = z.infer<typeof liveSessionCreateSchema>;

export const attendanceOverrideSchema = z.object({
  studentId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  present: z.boolean(),
  joinedAt: z.coerce.date().optional(),
  leftAt: z.coerce.date().optional(),
  durationSeconds: z.number().int().min(0).optional(),
  source: z.enum(ATTENDANCE_SOURCES).default('manual'),
  overrideReason: z.string().min(1).max(1000),
});
export type AttendanceOverrideInput = z.infer<typeof attendanceOverrideSchema>;

export const livePollCreateSchema = z.object({
  question: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).min(2).max(8),
});
export type LivePollCreateInput = z.infer<typeof livePollCreateSchema>;

export const livePollResponseSchema = z.object({
  optionIndex: z.number().int().min(0),
});
export type LivePollResponseInput = z.infer<typeof livePollResponseSchema>;

export const liveChatMessageCreateSchema = z.object({
  body: z.string().min(1).max(2000),
});
export type LiveChatMessageCreateInput = z.infer<typeof liveChatMessageCreateSchema>;

const whiteboardPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const liveWhiteboardEventCreateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('stroke'),
    color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#111827'),
    width: z.number().min(1).max(20).default(3),
    points: z.array(whiteboardPointSchema).min(2).max(500),
  }),
  z.object({
    kind: z.literal('clear'),
  }),
]);
export type LiveWhiteboardEventCreateInput = z.infer<typeof liveWhiteboardEventCreateSchema>;

export const liveBreakoutRoomCreateSchema = z.object({
  rooms: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        participantIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).default([]),
      }),
    )
    .min(1)
    .max(20),
});
export type LiveBreakoutRoomCreateInput = z.infer<typeof liveBreakoutRoomCreateSchema>;

export const providerAttendanceReportSchema = z.object({
  providerMeetingId: z.string().max(200).optional(),
  recordingUrl: z.string().url().optional(),
  recordingDurationSeconds: z.number().int().min(0).optional(),
  attendees: z
    .array(
      z.object({
        email: z.string().email(),
        joinedAt: z.coerce.date().optional(),
        leftAt: z.coerce.date().optional(),
        durationSeconds: z.number().int().min(0).optional(),
        present: z.boolean().optional(),
      }),
    )
    .default([]),
});
export type ProviderAttendanceReportInput = z.infer<typeof providerAttendanceReportSchema>;

export const nativeRecordingCompleteSchema = z.object({
  storageKey: z.string().min(1),
  durationSeconds: z.number().int().min(0).optional(),
});
export type NativeRecordingCompleteInput = z.infer<typeof nativeRecordingCompleteSchema>;

export const nativeRecordingFailedSchema = z.object({
  error: z.string().min(1).max(1000),
});
export type NativeRecordingFailedInput = z.infer<typeof nativeRecordingFailedSchema>;
