import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InstitutionModel } from '../src/models/institution.model';
import { UserModel } from '../src/models/user.model';
import { CourseModel } from '../src/models/course.model';
import { AuditLogModel } from '../src/models/audit-log.model';
import {
  archiveCourse,
  cloneCourse,
  createCourse,
  getCourse,
  listCourses,
  submitForReview,
  updateCourse,
} from '../src/services/course.service';
import {
  approveCourse,
  listPendingReview,
  rejectCourse,
} from '../src/services/course-approval.service';
import type { AuthContext } from '../src/rbac/roles';

async function makeInstitution(slug: string) {
  const inst = await InstitutionModel.create({ name: slug, slug });
  return String(inst._id);
}
async function makeUser(institutionId: string, role: AuthContext['role']): Promise<AuthContext> {
  const u = await UserModel.create({
    institutionId,
    email: `${role}-${Math.floor(performance.now() * 1000)}@x.com`,
    fullName: role,
    role,
    status: 'active',
  });
  return { userId: String(u._id), institutionId, role };
}

const sampleModules = [
  {
    title: 'Module 1',
    lessons: [
      { title: 'Lesson 1', contentItems: [{ type: 'article' as const, title: 'Intro', textBody: 'hi' }] },
    ],
  },
  { title: 'Module 2', lessons: [] },
];

let institutionId: string;
let instructor: AuthContext;
let admin: AuthContext;

beforeAll(async () => {
  await CourseModel.createIndexes();
});

beforeEach(async () => {
  institutionId = await makeInstitution('lumora');
  instructor = await makeUser(institutionId, 'instructor');
  admin = await makeUser(institutionId, 'admin');
});

describe('course authoring (FR-COURSE-01..06)', () => {
  it('creates a draft with a generated slug', async () => {
    const c = await createCourse(instructor, { title: 'UX Foundations', language: 'en', enrollmentMode: 'open' });
    expect(c.status).toBe('draft');
    expect(c.slug).toBe('ux-foundations');
    expect(c.instructorId).toBe(instructor.userId);
  });

  it('gives duplicate titles distinct slugs', async () => {
    const a = await createCourse(instructor, { title: 'Same', language: 'en', enrollmentMode: 'open' });
    const b = await createCourse(instructor, { title: 'Same', language: 'en', enrollmentMode: 'open' });
    expect(a.slug).toBe('same');
    expect(b.slug).toBe('same-2');
  });

  it('edits modules, deriving order from array position and preserving ids on reorder', async () => {
    const c = await createCourse(instructor, { title: 'C', language: 'en', enrollmentMode: 'open' });
    const withModules = await updateCourse(instructor, c.id, { modules: sampleModules });
    expect(withModules.modules).toHaveLength(2);
    expect(withModules.modules[0]!.order).toBe(0);
    expect(withModules.modules[0]!.lessons[0]!.contentItems[0]!.type).toBe('article');

    // Reverse the order, keeping ids -> order should follow new positions.
    const reversed = [...withModules.modules].reverse().map((m) => ({
      _id: m.id,
      title: m.title,
      lessons: m.lessons.map((l) => ({ _id: l.id, title: l.title, contentItems: [] })),
    }));
    const after = await updateCourse(instructor, c.id, { modules: reversed });
    expect(after.modules[0]!.id).toBe(withModules.modules[1]!.id); // was Module 2
    expect(after.modules[0]!.order).toBe(0);
  });

  it('refuses edits once the course is not a draft', async () => {
    const c = await createCourse(instructor, { title: 'C', language: 'en', enrollmentMode: 'open' });
    await updateCourse(instructor, c.id, { modules: sampleModules });
    await submitForReview(instructor, c.id);
    await expect(updateCourse(instructor, c.id, { title: 'X' })).rejects.toMatchObject({ httpStatus: 400 });
  });
});

describe('ownership + tenant isolation', () => {
  it('prevents another instructor from editing a course they do not own', async () => {
    const other = await makeUser(institutionId, 'instructor');
    const c = await createCourse(instructor, { title: 'Mine', language: 'en', enrollmentMode: 'open' });
    await expect(updateCourse(other, c.id, { title: 'Hacked' })).rejects.toMatchObject({ httpStatus: 403 });
  });

  it('cannot load a course from another institution', async () => {
    const c = await createCourse(instructor, { title: 'Mine', language: 'en', enrollmentMode: 'open' });
    const otherInst = await makeInstitution('other');
    const otherAdmin = await makeUser(otherInst, 'admin');
    await expect(getCourse(otherAdmin, c.id)).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('hides draft courses from students but shows published ones', async () => {
    const student = await makeUser(institutionId, 'student');
    const c = await createCourse(instructor, { title: 'Secret', language: 'en', enrollmentMode: 'open' });
    await expect(getCourse(student, c.id)).rejects.toMatchObject({ httpStatus: 403 });

    await updateCourse(instructor, c.id, { modules: sampleModules });
    await submitForReview(instructor, c.id);
    await approveCourse(admin, c.id);
    const seen = await getCourse(student, c.id);
    expect(seen.status).toBe('published');
  });
});

describe('approval workflow (UC-03, FR-COURSE-07/08, FR-ADMIN-02)', () => {
  async function draftReadyForReview() {
    const c = await createCourse(instructor, { title: 'Approvable', language: 'en', enrollmentMode: 'open' });
    await updateCourse(instructor, c.id, { modules: sampleModules });
    await submitForReview(instructor, c.id);
    return c.id;
  }

  it('blocks submitting a course with no modules', async () => {
    const c = await createCourse(instructor, { title: 'Empty', language: 'en', enrollmentMode: 'open' });
    await expect(submitForReview(instructor, c.id)).rejects.toMatchObject({ httpStatus: 400 });
  });

  it('lists pending review, approves (publish + version bump + audit)', async () => {
    const id = await draftReadyForReview();
    const queue = await listPendingReview(admin);
    expect(queue.courses.map((c) => c.id)).toContain(id);

    const approved = await approveCourse(admin, id);
    expect(approved.status).toBe('published');
    expect(approved.version).toBe(2);
    expect(approved.publishedAt).toBeTruthy();

    const audit = await AuditLogModel.findOne({ action: 'course.publish', 'targetEntity.id': id }).lean();
    expect(audit).toBeTruthy();
  });

  it('rejects with a comment, returning the course to draft (audited)', async () => {
    const id = await draftReadyForReview();
    const rejected = await rejectCourse(admin, id, 'Needs more depth in Module 2.');
    expect(rejected.status).toBe('draft');
    expect(rejected.reviewComment).toBe('Needs more depth in Module 2.');

    const audit = await AuditLogModel.findOne({ action: 'course.reject', 'targetEntity.id': id }).lean();
    expect(audit).toBeTruthy();

    // Instructor can now edit again and resubmit.
    await expect(updateCourse(instructor, id, { title: 'Approvable v2' })).resolves.toBeTruthy();
  });
});

describe('templates + clone (FR-COURSE-05)', () => {
  it('clones a course as a template and instantiates a fresh course from it', async () => {
    const c = await createCourse(instructor, { title: 'Base', language: 'en', enrollmentMode: 'open' });
    await updateCourse(instructor, c.id, { modules: sampleModules });

    const template = await cloneCourse(instructor, c.id, { asTemplate: true });
    expect(template.isTemplate).toBe(true);
    expect(template.status).toBe('draft');
    expect(template.modules).toHaveLength(2);
    // Fresh ids, not shared with the source.
    expect(template.modules[0]!.id).not.toBe(c.id);

    const templates = await listCourses(instructor, { scope: 'templates', page: 1, pageSize: 20 });
    expect(templates.courses.map((t) => t.id)).toContain(template.id);

    const instance = await cloneCourse(instructor, template.id, { asTemplate: false, title: 'Fall Cohort' });
    expect(instance.isTemplate).toBe(false);
    expect(instance.title).toBe('Fall Cohort');
    expect(instance.clonedFromCourseId).toBe(template.id);
    expect(instance.modules).toHaveLength(2);
  });
});

describe('catalog + archive', () => {
  it('lists only published courses in the catalog', async () => {
    const draft = await createCourse(instructor, { title: 'Draft One', language: 'en', enrollmentMode: 'open' });
    await updateCourse(instructor, draft.id, { modules: sampleModules });

    const pub = await createCourse(instructor, { title: 'Public One', language: 'en', enrollmentMode: 'open' });
    await updateCourse(instructor, pub.id, { modules: sampleModules });
    await submitForReview(instructor, pub.id);
    await approveCourse(admin, pub.id);

    const catalog = await listCourses(instructor, { scope: 'catalog', page: 1, pageSize: 20 });
    const ids = catalog.courses.map((c) => c.id);
    expect(ids).toContain(pub.id);
    expect(ids).not.toContain(draft.id);
  });

  it('archives a published course', async () => {
    const c = await createCourse(instructor, { title: 'ToArchive', language: 'en', enrollmentMode: 'open' });
    await updateCourse(instructor, c.id, { modules: sampleModules });
    await submitForReview(instructor, c.id);
    await approveCourse(admin, c.id);
    const archived = await archiveCourse(instructor, c.id);
    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toBeTruthy();
  });
});
