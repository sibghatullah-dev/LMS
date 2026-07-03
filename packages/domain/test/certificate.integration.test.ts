import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AssessmentModel } from '../src/models/assessment.model';
import { CertificateModel } from '../src/models/certificate.model';
import { CourseModel } from '../src/models/course.model';
import { EnrollmentModel } from '../src/models/enrollment.model';
import { InstitutionModel } from '../src/models/institution.model';
import { SubmissionModel } from '../src/models/submission.model';
import { UserModel } from '../src/models/user.model';
import type { AuthContext } from '../src/rbac/roles';
import { createAssessment, gradeSubmission, submitAssessment } from '../src/services/assessment.service';
import { getCertificateForDownload, verifyCertificate } from '../src/services/certificate.service';
import { createCourse, updateCourse } from '../src/services/course.service';

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

let institutionId: string;
let instructor: AuthContext;
let student: AuthContext;
let courseId: string;

beforeAll(async () => {
  await Promise.all([
    CourseModel.createIndexes(),
    AssessmentModel.createIndexes(),
    SubmissionModel.createIndexes(),
    CertificateModel.createIndexes(),
  ]);
});

beforeEach(async () => {
  institutionId = await makeInstitution('lumora-cert');
  instructor = await makeUser(institutionId, 'instructor');
  student = await makeUser(institutionId, 'student');
  const course = await createCourse(instructor, {
    title: 'Certificate Course',
    language: 'en',
    enrollmentMode: 'open',
    completionCriteria: { minGradePercent: 80, minAttendancePercent: 0 },
  });
  courseId = course.id;
  await updateCourse(instructor, courseId, {
    modules: [{ title: 'Module 1', lessons: [{ title: 'Lesson 1', contentItems: [] }] }],
  });
  await CourseModel.updateOne({ _id: courseId }, { $set: { status: 'published' } });
  await EnrollmentModel.create({
    institutionId,
    courseId,
    studentId: student.userId,
    status: 'active',
    enrolledAt: new Date(),
  });
});

describe('Phase 8 certificates', () => {
  it('issues and verifies a certificate when completion criteria are met', async () => {
    const assessment = await createAssessment(instructor, courseId, {
      type: 'assignment',
      title: 'Final',
      maxScore: 100,
      weightPercent: 100,
      status: 'published',
      submissionTypes: ['text'],
    });
    const submission = await submitAssessment(student, assessment.id, { textResponse: 'complete' });
    await gradeSubmission(instructor, submission.id, { totalScore: 85 });

    const certificate = await CertificateModel.findOne({ studentId: student.userId, courseId });
    expect(certificate).toBeTruthy();
    expect(certificate!.verificationCode).toMatch(/^LUM-/);
    expect(certificate!.finalGradePercent).toBe(85);

    const enrollment = await EnrollmentModel.findOne({ studentId: student.userId, courseId });
    expect(enrollment!.status).toBe('completed');
    expect(enrollment!.completedAt).toBeTruthy();

    const verified = await verifyCertificate(certificate!.verificationCode);
    expect(verified.courseId).toBe(courseId);
    expect(verified.downloadUrl).toContain('/api/v1/certificates/');
  });

  it('does not issue a certificate below the minimum grade', async () => {
    const assessment = await createAssessment(instructor, courseId, {
      type: 'assignment',
      title: 'Final',
      maxScore: 100,
      weightPercent: 100,
      status: 'published',
      submissionTypes: ['text'],
    });
    const submission = await submitAssessment(student, assessment.id, { textResponse: 'incomplete' });
    await gradeSubmission(instructor, submission.id, { totalScore: 79 });

    expect(await CertificateModel.findOne({ studentId: student.userId, courseId })).toBeNull();
    const enrollment = await EnrollmentModel.findOne({ studentId: student.userId, courseId });
    expect(enrollment!.status).toBe('active');
  });
});

describe('regression: certificate download authorization (NFR-PRIV-02)', () => {
  async function issueCertificate() {
    const assessment = await createAssessment(instructor, courseId, {
      type: 'assignment',
      title: 'Final',
      maxScore: 100,
      weightPercent: 100,
      status: 'published',
      submissionTypes: ['text'],
    });
    const submission = await submitAssessment(student, assessment.id, { textResponse: 'complete' });
    await gradeSubmission(instructor, submission.id, { totalScore: 90 });
    const certificate = await CertificateModel.findOne({ studentId: student.userId, courseId });
    return String(certificate!._id);
  }

  it('the owning student and the issuing institution staff can download', async () => {
    const certificateId = await issueCertificate();
    await expect(getCertificateForDownload(student, certificateId)).resolves.toBeTruthy();
    await expect(getCertificateForDownload(instructor, certificateId)).resolves.toBeTruthy();
  });

  it('a student from the same institution who does not own it cannot download', async () => {
    const certificateId = await issueCertificate();
    const otherStudent = await makeUser(institutionId, 'student');
    await expect(getCertificateForDownload(otherStudent, certificateId)).rejects.toMatchObject({
      httpStatus: 403,
    });
  });

  it('staff from a DIFFERENT institution cannot download (tenant isolation)', async () => {
    // Bug: loadCertificate previously queried CertificateModel.findById with no
    // institutionId filter, so any staff role — regardless of institution —
    // could download another institution's certificate PDF (name + grade).
    const certificateId = await issueCertificate();
    const otherInstitutionId = await makeInstitution('other-school');
    const otherInstructor = await makeUser(otherInstitutionId, 'instructor');
    await expect(getCertificateForDownload(otherInstructor, certificateId)).rejects.toMatchObject({
      httpStatus: 404,
    });
  });
});
