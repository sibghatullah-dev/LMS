import crypto from 'node:crypto';
import mongoose, { type HydratedDocument } from 'mongoose';
import { CertificateModel, type Certificate } from '../models/certificate.model';
import { CourseModel } from '../models/course.model';
import { EnrollmentModel } from '../models/enrollment.model';
import { UserModel } from '../models/user.model';
import { ForbiddenError, NotFoundError } from '../errors';
import { hasAnyRole, type AuthContext } from '../rbac/roles';
import { notifyUser } from './notification.service';
import { awardCourseCompletion } from './gamification.service';

const { Types } = mongoose;

function verificationCode(): string {
  return `LUM-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

function certificateStorageKey(institutionId: string, courseId: string, studentId: string): string {
  return `institutions/${institutionId}/courses/${courseId}/certificates/${studentId}.pdf`;
}

function downloadUrl(id: string): string {
  return `/api/v1/certificates/${id}/download`;
}

function toPublicCertificate(doc: HydratedDocument<Certificate>) {
  return {
    id: String(doc._id),
    studentId: String(doc.studentId),
    courseId: String(doc.courseId),
    verificationCode: doc.verificationCode,
    issuedAt: doc.issuedAt,
    finalGradePercent: doc.finalGradePercent,
    downloadUrl: downloadUrl(String(doc._id)),
  };
}

export async function issueCertificateIfEligible(studentId: string, courseId: string) {
  const [course, enrollment] = await Promise.all([
    CourseModel.findById(courseId),
    EnrollmentModel.findOne({ studentId, courseId, status: { $in: ['active', 'completed'] } }),
  ]);
  if (!course || !enrollment) return null;

  const minGrade = course.completionCriteria?.minGradePercent ?? 0;
  const minAttendance = course.completionCriteria?.minAttendancePercent ?? 0;
  const finalGrade = enrollment.finalGradePercent;
  if (finalGrade == null || finalGrade < minGrade) return null;
  // Attendance is introduced in Phase 10. Until then, only criteria with 0 attendance are eligible.
  if (minAttendance > 0) return null;

  let certificate = await CertificateModel.findOne({ studentId, courseId });
  if (!certificate) {
    certificate = await CertificateModel.create({
      institutionId: course.institutionId,
      studentId,
      courseId,
      verificationCode: verificationCode(),
      storageKey: certificateStorageKey(String(course.institutionId), courseId, studentId),
      issuedAt: new Date(),
      finalGradePercent: finalGrade,
    });
  }

  if (enrollment.status !== 'completed') {
    enrollment.status = 'completed';
    enrollment.completedAt = certificate.issuedAt;
    await enrollment.save();
  }

  await awardCourseCompletion(studentId, courseId);

  await notifyUser({
    institutionId: String(course.institutionId),
    userId: studentId,
    type: 'course_review',
    title: 'Certificate issued',
    body: `Your certificate for ${course.title} is ready.`,
    actionUrl: '/certificates',
    relatedEntity: { type: 'certificate', id: certificate._id },
  });

  return certificate;
}

export async function listMyCertificates(ctx: AuthContext) {
  const docs = await CertificateModel.find({
    institutionId: ctx.institutionId,
    studentId: ctx.userId,
  }).sort({ issuedAt: -1 });
  return docs.map(toPublicCertificate);
}

export async function verifyCertificate(verificationCode: string) {
  const doc = await CertificateModel.findOne({ verificationCode });
  if (!doc) throw NotFoundError('Certificate not found.');
  return toPublicCertificate(doc);
}

/**
 * Tenant-scoped by institutionId (unlike `verifyCertificate`, which is
 * intentionally public/global per FR-CERT-02's verification-code lookup) —
 * the download path returns PII (name, grade) and must not resolve a
 * certificate belonging to a different institution.
 */
async function loadCertificateInTenant(ctx: AuthContext, certificateId: string) {
  if (!Types.ObjectId.isValid(certificateId)) throw NotFoundError('Certificate not found.');
  const certificate = await CertificateModel.findOne({
    _id: certificateId,
    institutionId: ctx.institutionId,
  });
  if (!certificate) throw NotFoundError('Certificate not found.');
  return certificate;
}

/**
 * Requires an authenticated caller (the route enforces this — see
 * NFR-PRIV-02). Only the certificate's own student, or staff within the
 * *same* institution, may download it.
 */
export async function getCertificateForDownload(ctx: AuthContext, certificateId: string) {
  const certificate = await loadCertificateInTenant(ctx, certificateId);
  const isOwner = String(certificate.studentId) === ctx.userId;
  const isStaff = hasAnyRole(ctx.role, ['admin', 'super_admin', 'instructor']);
  if (!isOwner && !isStaff) throw ForbiddenError('You do not have access to this certificate.');
  const [student, course] = await Promise.all([
    UserModel.findById(certificate.studentId).select('fullName'),
    CourseModel.findById(certificate.courseId).select('title'),
  ]);
  return {
    certificate: toPublicCertificate(certificate),
    studentName: student?.fullName ?? 'Student',
    courseTitle: course?.title ?? 'Course',
  };
}

export function renderCertificatePdf(input: {
  studentName: string;
  courseTitle: string;
  verificationCode: string;
  issuedAt: Date;
  finalGradePercent: number;
}): Buffer {
  const lines = [
    'Lumora Certificate of Completion',
    `Awarded to: ${input.studentName}`,
    `Course: ${input.courseTitle}`,
    `Final grade: ${input.finalGradePercent}%`,
    `Issued: ${input.issuedAt.toISOString().slice(0, 10)}`,
    `Verification code: ${input.verificationCode}`,
  ];
  const text = lines.map(escapePdfText).join(') Tj T* (');
  const stream = `BT /F1 20 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`,
  ];
  const body = objects.join('\n');
  return Buffer.from(`%PDF-1.4\n${body}\n%%EOF\n`);
}

function escapePdfText(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}
