import { beforeEach, describe, expect, it } from 'vitest';
import { CourseModel } from '../src/models/course.model';
import { EnrollmentModel } from '../src/models/enrollment.model';
import { InstitutionModel } from '../src/models/institution.model';
import { SubmissionModel } from '../src/models/submission.model';
import { UserModel } from '../src/models/user.model';
import type { AuthContext } from '../src/rbac/roles';
import { createCourse } from '../src/services/course.service';
import { eraseMyAccount, exportMyData } from '../src/services/privacy.service';

async function makeInstitution(slug: string) {
  const inst = await InstitutionModel.create({ name: slug, slug });
  return String(inst._id);
}

async function makeUser(institutionId: string, role: AuthContext['role']): Promise<AuthContext> {
  const u = await UserModel.create({
    institutionId,
    email: `${role}-${Math.floor(performance.now() * 1000)}@x.com`,
    fullName: `${role} User`,
    role,
    status: 'active',
    emailVerifiedAt: new Date(),
  });
  return { userId: String(u._id), institutionId, role };
}

let institutionId: string;
let student: AuthContext;
let instructor: AuthContext;
let courseId: string;

beforeEach(async () => {
  institutionId = await makeInstitution('lumora-privacy');
  student = await makeUser(institutionId, 'student');
  instructor = await makeUser(institutionId, 'instructor');
  const course = await createCourse(instructor, { title: 'Privacy Course', language: 'en' });
  courseId = course.id;
  await CourseModel.updateOne({ _id: courseId }, { $set: { status: 'published' } });
  await EnrollmentModel.create({
    institutionId,
    courseId,
    studentId: student.userId,
    status: 'active',
    finalGradePercent: 92,
  });
  await SubmissionModel.create({
    institutionId,
    courseId,
    assessmentId: courseId,
    studentId: student.userId,
    submittedAt: new Date(),
    status: 'graded',
    isLate: false,
    totalScore: 92,
    totalScorePercent: 92,
  });
});

describe('privacy export and erasure (NFR-PRIV)', () => {
  it('exports user-owned records and scrubs direct PII on erasure', async () => {
    const exported = await exportMyData(student);
    expect(exported.user.email).toContain('@x.com');
    expect(exported.enrollments).toHaveLength(1);
    expect(exported.submissions).toHaveLength(1);

    await expect(eraseMyAccount(student, 'WRONG')).rejects.toMatchObject({ httpStatus: 400 });
    const result = await eraseMyAccount(student, 'ERASE');
    expect(result.status).toBe('deactivated');

    const scrubbed = await UserModel.findById(student.userId);
    expect(scrubbed!.email).toBe(`deleted-${student.userId}@deleted.lumora.local`);
    expect(scrubbed!.fullName).toBe('Deleted user');
    expect(scrubbed!.status).toBe('deactivated');
    expect(scrubbed!.notificationPreferences?.email).toBe(false);

    expect(await EnrollmentModel.countDocuments({ studentId: student.userId })).toBe(1);
    expect(await SubmissionModel.countDocuments({ studentId: student.userId })).toBe(1);
  });
});
