import type { HydratedDocument } from 'mongoose';
import type { Course } from '../models/course.model';

/** Public JSON shape of a course (nested `_id` → `id`, ObjectIds stringified). */
export interface PublicCourse {
  id: string;
  institutionId: string;
  instructorId: string;
  title: string;
  slug: string;
  description: string;
  category?: string;
  coverImageUrl?: string;
  language: string;
  estimatedDurationHours?: number;
  status: string;
  reviewComment?: string;
  enrollmentMode: string;
  enrollmentCapacity?: number | null;
  isTemplate: boolean;
  clonedFromCourseId?: string;
  completionCriteria: { minGradePercent: number; minAttendancePercent: number };
  modules: PublicModule[];
  version: number;
  publishedAt?: Date;
  archivedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PublicModule {
  id: string;
  title: string;
  order: number;
  releaseRule: { type: string; date?: Date; offsetDays?: number };
  lessons: PublicLesson[];
}
interface PublicLesson {
  id: string;
  title: string;
  order: number;
  contentItems: PublicContentItem[];
}
interface PublicContentItem {
  id: string;
  type: string;
  title: string;
  storageKey?: string;
  streamingManifestUrl?: string;
  textBody?: string;
  linkedAssessmentId?: string;
  durationSeconds?: number;
  order: number;
}

const str = (v: unknown) => (v == null ? undefined : String(v));

export function toPublicCourse(doc: HydratedDocument<Course>): PublicCourse {
  const c = doc.toObject();
  return {
    id: String(c._id),
    institutionId: String(c.institutionId),
    instructorId: String(c.instructorId),
    title: c.title,
    slug: c.slug,
    description: c.description ?? '',
    category: c.category ?? undefined,
    coverImageUrl: c.coverImageUrl ?? undefined,
    language: c.language ?? 'en',
    estimatedDurationHours: c.estimatedDurationHours ?? undefined,
    status: c.status,
    reviewComment: c.reviewComment ?? undefined,
    enrollmentMode: c.enrollmentMode ?? 'open',
    enrollmentCapacity: c.enrollmentCapacity ?? null,
    isTemplate: Boolean(c.isTemplate),
    clonedFromCourseId: str(c.clonedFromCourseId),
    completionCriteria: {
      minGradePercent: c.completionCriteria?.minGradePercent ?? 0,
      minAttendancePercent: c.completionCriteria?.minAttendancePercent ?? 0,
    },
    modules: (c.modules ?? []).map((m) => ({
      id: String(m._id),
      title: m.title,
      order: m.order,
      releaseRule: {
        type: m.releaseRule?.type ?? 'immediate',
        date: m.releaseRule?.date ?? undefined,
        offsetDays: m.releaseRule?.offsetDays ?? undefined,
      },
      lessons: (m.lessons ?? []).map((l) => ({
        id: String(l._id),
        title: l.title,
        order: l.order,
        contentItems: (l.contentItems ?? []).map((ci) => ({
          id: String(ci._id),
          type: ci.type,
          title: ci.title,
          storageKey: ci.storageKey ?? undefined,
          streamingManifestUrl: ci.streamingManifestUrl ?? undefined,
          textBody: ci.textBody ?? undefined,
          linkedAssessmentId: str(ci.linkedAssessmentId),
          durationSeconds: ci.durationSeconds ?? undefined,
          order: ci.order,
        })),
      })),
    })),
    version: c.version ?? 1,
    publishedAt: c.publishedAt ?? undefined,
    archivedAt: c.archivedAt ?? undefined,
    createdAt: (c as { createdAt?: Date }).createdAt,
    updatedAt: (c as { updatedAt?: Date }).updatedAt,
  };
}

/** Lightweight card shape for catalog/list views. */
export function toCourseCard(doc: HydratedDocument<Course>) {
  const c = doc.toObject();
  return {
    id: String(c._id),
    title: c.title,
    slug: c.slug,
    description: c.description ?? '',
    category: c.category ?? undefined,
    coverImageUrl: c.coverImageUrl ?? undefined,
    status: c.status,
    isTemplate: Boolean(c.isTemplate),
    moduleCount: (c.modules ?? []).length,
    lessonCount: (c.modules ?? []).reduce((n, m) => n + (m.lessons?.length ?? 0), 0),
    enrollmentMode: c.enrollmentMode ?? 'open',
    instructorId: String(c.instructorId),
    updatedAt: (c as { updatedAt?: Date }).updatedAt,
  };
}
