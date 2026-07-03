import { z } from 'zod';
import { LESSON_PROGRESS_STATUSES } from '@lumora/config';

/** POST /content/upload-url — request a presigned upload target (FR-CONTENT-02, NFR-SEC-05). */
export const uploadUrlSchema = z.object({
  courseId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive(),
  // Drives the applicable size limit and light MIME validation.
  kind: z.enum(['video', 'audio', 'document', 'downloadable']),
});
export type UploadUrlInput = z.infer<typeof uploadUrlSchema>;

/** PUT /courses/{courseId}/lessons/{lessonId}/progress (FR-CONTENT-03). */
export const lessonProgressSchema = z.object({
  percentConsumed: z.number().min(0).max(100).optional(),
  status: z.enum(LESSON_PROGRESS_STATUSES).optional(),
});
export type LessonProgressInput = z.infer<typeof lessonProgressSchema>;
