import { z } from 'zod';

export const eventListQuerySchema = z.object({
  includePast: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type EventListQueryInput = z.infer<typeof eventListQuerySchema>;

export const eventCreateSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    capacity: z.number().int().positive().optional(),
    location: z.string().max(500).optional(),
    joinUrl: z.string().url().optional(),
  })
  .refine((input) => input.endsAt > input.startsAt, {
    message: 'Event end must be after start.',
    path: ['endsAt'],
  });
export type EventCreateInput = z.infer<typeof eventCreateSchema>;

export const eventRegisterSchema = z.object({});
export type EventRegisterInput = z.infer<typeof eventRegisterSchema>;
