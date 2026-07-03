import { z } from 'zod';
import { NOTIFICATION_TYPES } from '@lumora/config';

export const listNotificationsSchema = z.object({
  unreadOnly: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;

export const createAnnouncementSchema = z.object({
  courseId: z.string().regex(/^[a-f\d]{24}$/i),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
