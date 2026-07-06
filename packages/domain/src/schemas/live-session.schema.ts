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
  })
  .refine((input) => input.deliveryMode === 'native' || Boolean(input.joinUrl), {
    message: 'A join URL is required for Zoom or MS Teams sessions in local MVP mode.',
    path: ['joinUrl'],
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
