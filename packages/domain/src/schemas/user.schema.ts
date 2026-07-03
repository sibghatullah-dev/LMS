import { z } from 'zod';
import { ROLES } from '@lumora/config';

/** PATCH /users/me — a user editing their own profile & preferences. */
export const updateMeSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  avatarUrl: z.string().url().optional(),
  locale: z.string().min(2).max(10).optional(),
  notificationPreferences: z
    .object({
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
      inApp: z.boolean().optional(),
    })
    .optional(),
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

/** Admin: create a user within their institution (FR-ADMIN-01). */
export const adminCreateUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(200),
  role: z.enum(ROLES),
  // Optional initial password; if omitted the account is created pending a
  // password-reset ("set password") flow.
  password: z.string().min(8).optional(),
});
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;

/** Admin: change a user's role (FR-ADMIN-01, audited). */
export const adminChangeRoleSchema = z.object({
  role: z.enum(ROLES),
});
export type AdminChangeRoleInput = z.infer<typeof adminChangeRoleSchema>;

/** Admin: list/query users. */
export const adminListUsersSchema = z.object({
  role: z.enum(ROLES).optional(),
  status: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminListUsersInput = z.infer<typeof adminListUsersSchema>;
