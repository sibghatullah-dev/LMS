import { z } from 'zod';

export const eraseAccountSchema = z.object({
  confirmation: z.literal('ERASE'),
});
export type EraseAccountInput = z.infer<typeof eraseAccountSchema>;
