import mongoose, { type FilterQuery, type HydratedDocument } from 'mongoose';
import { CourseModel, type Course } from '../models/course.model';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { hasAnyRole, type AuthContext } from '../rbac/roles';
import type {
  CloneCourseInput,
  CreateCourseInput,
  ListCoursesInput,
  ModuleInput,
  UpdateCourseInput,
} from '../schemas/course.schema';
import { assertTransition } from './course-state';
import { toCourseCard, toPublicCourse, type PublicCourse } from './course-serialize';
import { slugify, uniqueSlug } from './slug';

const { Types } = mongoose;

type CourseDoc = HydratedDocument<Course>;

const isManager = (ctx: AuthContext) => hasAnyRole(ctx.role, ['admin', 'super_admin']);

/** Load a course scoped to the institution, or throw 404. */
async function loadInTenant(ctx: AuthContext, courseId: string): Promise<CourseDoc> {
  if (!Types.ObjectId.isValid(courseId)) throw NotFoundError('Course not found.');
  const course = await CourseModel.findOne({
    _id: courseId,
    institutionId: ctx.institutionId,
  });
  if (!course) throw NotFoundError('Course not found.');
  return course;
}

/** Owner instructor or an admin may manage a course. */
function assertCanManage(ctx: AuthContext, course: CourseDoc): void {
  if (isManager(ctx)) return;
  if (String(course.instructorId) === ctx.userId) return;
  throw ForbiddenError('You do not have access to this course.');
}

/** Map validated module input to embedded docs, deriving `order` from array index. */
function buildModules(modules: ModuleInput[]): unknown[] {
  return modules.map((m, mi) => ({
    _id: m._id && Types.ObjectId.isValid(m._id) ? new Types.ObjectId(m._id) : new Types.ObjectId(),
    title: m.title,
    order: mi,
    releaseRule: m.releaseRule ?? { type: 'immediate' },
    lessons: m.lessons.map((l, li) => ({
      _id: l._id && Types.ObjectId.isValid(l._id) ? new Types.ObjectId(l._id) : new Types.ObjectId(),
      title: l.title,
      order: li,
      contentItems: l.contentItems.map((ci, cii) => ({
        _id:
          ci._id && Types.ObjectId.isValid(ci._id) ? new Types.ObjectId(ci._id) : new Types.ObjectId(),
        type: ci.type,
        title: ci.title,
        storageKey: ci.storageKey,
        streamingManifestUrl: ci.streamingManifestUrl,
        textBody: ci.textBody,
        linkedAssessmentId:
          ci.linkedAssessmentId && Types.ObjectId.isValid(ci.linkedAssessmentId)
            ? new Types.ObjectId(ci.linkedAssessmentId)
            : undefined,
        durationSeconds: ci.durationSeconds,
        order: cii,
      })),
    })),
  }));
}

async function slugFor(institutionId: string, title: string): Promise<string> {
  return uniqueSlug(slugify(title), async (candidate) => {
    const exists = await CourseModel.exists({ institutionId, slug: candidate });
    return Boolean(exists);
  });
}

/** FR-COURSE-01 — create a draft course. */
export async function createCourse(
  ctx: AuthContext,
  input: CreateCourseInput,
): Promise<PublicCourse> {
  const slug = await slugFor(ctx.institutionId, input.title);
  const course = await CourseModel.create({
    institutionId: ctx.institutionId,
    instructorId: ctx.userId,
    title: input.title,
    slug,
    description: input.description ?? '',
    category: input.category,
    coverImageUrl: input.coverImageUrl,
    language: input.language,
    estimatedDurationHours: input.estimatedDurationHours,
    enrollmentMode: input.enrollmentMode,
    enrollmentCapacity: input.enrollmentCapacity,
    completionCriteria: input.completionCriteria,
    status: 'draft',
  });
  return toPublicCourse(course);
}

/** GET a single course. Published courses are visible to any member of the
 *  institution; unpublished ones only to the owner or an admin. */
export async function getCourse(ctx: AuthContext, courseId: string): Promise<PublicCourse> {
  const course = await loadInTenant(ctx, courseId);
  if (course.status !== 'published') {
    assertCanManage(ctx, course);
  }
  return toPublicCourse(course);
}

/** List courses by scope: public `catalog`, instructor's `mine`, or `templates`. */
export async function listCourses(ctx: AuthContext, input: ListCoursesInput) {
  const filter: FilterQuery<Course> = { institutionId: ctx.institutionId };

  if (input.scope === 'mine') {
    filter.instructorId = ctx.userId;
    filter.isTemplate = false;
    if (input.status) filter.status = input.status;
  } else if (input.scope === 'templates') {
    filter.isTemplate = true;
    if (!isManager(ctx)) filter.instructorId = ctx.userId;
  } else {
    // catalog: only published, non-template courses
    filter.status = 'published';
    filter.isTemplate = false;
  }
  if (input.category) filter.category = input.category;
  if (input.q) filter.$text = { $search: input.q };

  const [docs, total] = await Promise.all([
    CourseModel.find(filter)
      .sort({ updatedAt: -1 })
      .skip((input.page - 1) * input.pageSize)
      .limit(input.pageSize),
    CourseModel.countDocuments(filter),
  ]);

  return {
    courses: docs.map(toCourseCard),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

/** FR-COURSE-02/03/06 — edit metadata and/or the module tree. Editable only in
 *  `draft` so published/graded cohorts are not altered underfoot (FR-COURSE-09). */
export async function updateCourse(
  ctx: AuthContext,
  courseId: string,
  input: UpdateCourseInput,
): Promise<PublicCourse> {
  const course = await loadInTenant(ctx, courseId);
  assertCanManage(ctx, course);
  if (course.status !== 'draft') {
    throw ValidationError('Only a draft course can be edited. Submit changes as a new revision.');
  }

  if (input.title !== undefined && input.title !== course.title) {
    course.title = input.title;
    course.slug = await slugFor(ctx.institutionId, input.title);
  }
  if (input.description !== undefined) course.description = input.description;
  if (input.category !== undefined) course.category = input.category;
  if (input.coverImageUrl !== undefined) course.coverImageUrl = input.coverImageUrl;
  if (input.language !== undefined) course.language = input.language;
  if (input.estimatedDurationHours !== undefined)
    course.estimatedDurationHours = input.estimatedDurationHours;
  if (input.enrollmentMode !== undefined) course.enrollmentMode = input.enrollmentMode;
  if (input.enrollmentCapacity !== undefined)
    course.enrollmentCapacity = input.enrollmentCapacity ?? undefined;
  if (input.completionCriteria !== undefined) course.completionCriteria = input.completionCriteria;
  if (input.modules !== undefined) {
    course.set('modules', buildModules(input.modules));
  }

  await course.save();
  return toPublicCourse(course);
}

/** FR-COURSE-07 — instructor submits a draft for admin review. */
export async function submitForReview(ctx: AuthContext, courseId: string): Promise<PublicCourse> {
  const course = await loadInTenant(ctx, courseId);
  assertCanManage(ctx, course);
  if (course.isTemplate) throw ValidationError('Templates are not published.');
  if ((course.modules?.length ?? 0) === 0) {
    throw ValidationError('Add at least one module before submitting for review.');
  }
  assertTransition(course.status, 'pending_review');
  course.status = 'pending_review';
  course.reviewComment = undefined;
  await course.save();
  return toPublicCourse(course);
}

/** FR-COURSE-10 — archive: hide from new enrollment, preserve for enrolled students. */
export async function archiveCourse(ctx: AuthContext, courseId: string): Promise<PublicCourse> {
  const course = await loadInTenant(ctx, courseId);
  assertCanManage(ctx, course);
  assertTransition(course.status, 'archived');
  course.status = 'archived';
  course.archivedAt = new Date();
  await course.save();
  return toPublicCourse(course);
}

/** FR-COURSE-05 — clone a course into a new draft, optionally as a reusable template. */
export async function cloneCourse(
  ctx: AuthContext,
  courseId: string,
  input: CloneCourseInput,
): Promise<PublicCourse> {
  const source = await loadInTenant(ctx, courseId);
  // Anyone who can view it (owner/admin, or any template in the institution) may clone.
  if (source.status !== 'published' && !source.isTemplate) {
    assertCanManage(ctx, source);
  }

  const title =
    input.title ?? `${source.title} (${input.asTemplate ? 'Template' : 'Copy'})`;
  const slug = await slugFor(ctx.institutionId, title);

  const clone = await CourseModel.create({
    institutionId: ctx.institutionId,
    instructorId: ctx.userId,
    title,
    slug,
    description: source.description,
    category: source.category,
    coverImageUrl: source.coverImageUrl,
    language: source.language,
    estimatedDurationHours: source.estimatedDurationHours,
    enrollmentMode: source.enrollmentMode,
    enrollmentCapacity: source.enrollmentCapacity,
    completionCriteria: source.completionCriteria,
    isTemplate: input.asTemplate,
    clonedFromCourseId: source._id,
    status: 'draft',
    // Deep-copy the structure with fresh ids.
    modules: buildModules(
      (source.toObject().modules ?? []).map((m) => ({
        title: m.title,
        releaseRule: m.releaseRule,
        lessons: (m.lessons ?? []).map((l) => ({
          title: l.title,
          contentItems: (l.contentItems ?? []).map((ci) => ({
            type: ci.type,
            title: ci.title,
            storageKey: ci.storageKey,
            streamingManifestUrl: ci.streamingManifestUrl,
            textBody: ci.textBody,
            linkedAssessmentId: ci.linkedAssessmentId ? String(ci.linkedAssessmentId) : undefined,
            durationSeconds: ci.durationSeconds,
          })),
        })),
      })) as ModuleInput[],
    ),
  });
  return toPublicCourse(clone);
}
