import { z } from 'zod';
import {
  CONTENT_ITEM_TYPES,
  COURSE_STATUSES,
  ENROLLMENT_MODES,
  RELEASE_RULE_TYPES,
} from '@lumora/config';

/** Completion criteria (DDD §3.3, FR-CERT-01). */
const completionCriteriaSchema = z.object({
  minGradePercent: z.number().min(0).max(100).default(0),
  minAttendancePercent: z.number().min(0).max(100).default(0),
});

/** Course metadata on create (FR-COURSE-01). */
export const createCourseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  coverImageUrl: z.string().url().optional(),
  language: z.string().min(2).max(10).default('en'),
  estimatedDurationHours: z.number().positive().optional(),
  enrollmentMode: z.enum(ENROLLMENT_MODES).default('open'),
  enrollmentCapacity: z.number().int().positive().optional(),
  completionCriteria: completionCriteriaSchema.optional(),
});
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

// --- Structure (modules → lessons → content items) ---------------------------
// `_id` is optional on input: present for existing nodes (preserved across edits),
// absent for new nodes (the server generates one). `order` is derived from array
// position on save, so reordering is just sending the array in the desired order
// (FR-COURSE-02/03).

const contentItemInputSchema = z.object({
  _id: z.string().optional(),
  type: z.enum(CONTENT_ITEM_TYPES),
  title: z.string().min(1).max(200),
  storageKey: z.string().optional(),
  streamingManifestUrl: z.string().optional(),
  textBody: z.string().optional(),
  linkedAssessmentId: z.string().optional(),
  durationSeconds: z.number().nonnegative().optional(),
});

const releaseRuleInputSchema = z.object({
  type: z.enum(RELEASE_RULE_TYPES).default('immediate'),
  date: z.coerce.date().optional(),
  offsetDays: z.number().int().nonnegative().optional(),
});

const lessonInputSchema = z.object({
  _id: z.string().optional(),
  title: z.string().min(1).max(200),
  contentItems: z.array(contentItemInputSchema).default([]),
});

const moduleInputSchema = z.object({
  _id: z.string().optional(),
  title: z.string().min(1).max(200),
  releaseRule: releaseRuleInputSchema.optional(),
  lessons: z.array(lessonInputSchema).default([]),
});

export type ModuleInput = z.infer<typeof moduleInputSchema>;

/** Course update: any metadata field and/or the full module tree (FR-COURSE-02/03/06). */
export const updateCourseSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    category: z.string().max(100).optional(),
    coverImageUrl: z.string().url().optional(),
    language: z.string().min(2).max(10).optional(),
    estimatedDurationHours: z.number().positive().optional(),
    enrollmentMode: z.enum(ENROLLMENT_MODES).optional(),
    enrollmentCapacity: z.number().int().positive().nullable().optional(),
    completionCriteria: completionCriteriaSchema.optional(),
    modules: z.array(moduleInputSchema).optional(),
  })
  .strict();
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

/** Admin rejection requires a comment (FR-COURSE-08). */
export const rejectCourseSchema = z.object({
  comment: z.string().min(1).max(2000),
});
export type RejectCourseInput = z.infer<typeof rejectCourseSchema>;

/** Clone a course into a new draft, optionally as a reusable template (FR-COURSE-05). */
export const cloneCourseSchema = z.object({
  asTemplate: z.boolean().default(false),
  title: z.string().min(1).max(200).optional(),
});
export type CloneCourseInput = z.infer<typeof cloneCourseSchema>;

/** List/catalog query. */
export const listCoursesSchema = z.object({
  scope: z.enum(['catalog', 'mine', 'templates']).default('catalog'),
  q: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(COURSE_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListCoursesInput = z.infer<typeof listCoursesSchema>;
