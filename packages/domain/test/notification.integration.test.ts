import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AssessmentModel } from '../src/models/assessment.model';
import { CourseModel } from '../src/models/course.model';
import { EnrollmentModel } from '../src/models/enrollment.model';
import { InstitutionModel } from '../src/models/institution.model';
import { NotificationModel } from '../src/models/notification.model';
import { SubmissionModel } from '../src/models/submission.model';
import { UserModel } from '../src/models/user.model';
import type { AuthContext } from '../src/rbac/roles';
import { createAssessment, gradeSubmission, submitAssessment } from '../src/services/assessment.service';
import { createCourse } from '../src/services/course.service';
import { listNotifications, markNotificationRead } from '../src/services/notification.service';

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
    NotificationModel.createIndexes(),
  ]);
});

beforeEach(async () => {
  institutionId = await makeInstitution('lumora-notify');
  instructor = await makeUser(institutionId, 'instructor');
  student = await makeUser(institutionId, 'student');
  const course = await createCourse(instructor, {
    title: 'Notification Course',
    language: 'en',
    enrollmentMode: 'open',
  });
  courseId = course.id;
  await CourseModel.updateOne({ _id: courseId }, { $set: { status: 'published' } });
  await EnrollmentModel.create({
    institutionId,
    courseId,
    studentId: student.userId,
    status: 'active',
    enrolledAt: new Date(),
  });
});

describe('Phase 7 notifications', () => {
  it('creates unread in-app notifications for submissions and posted grades', async () => {
    const assignment = await createAssessment(instructor, courseId, {
      type: 'assignment',
      title: 'Essay',
      maxScore: 100,
      weightPercent: 30,
      status: 'published',
      submissionTypes: ['text'],
    });
    const submission = await submitAssessment(student, assignment.id, { textResponse: 'Done' });

    const instructorNotifications = await listNotifications(instructor, {
      unreadOnly: true,
      page: 1,
      pageSize: 20,
    });
    expect(instructorNotifications.unreadCount).toBe(1);
    expect(instructorNotifications.notifications[0]!.type).toBe('submission_received');

    await gradeSubmission(instructor, submission.id, {
      totalScore: 91,
      instructorComment: 'Strong work.',
    });

    const studentNotifications = await listNotifications(student, {
      unreadOnly: true,
      page: 1,
      pageSize: 20,
    });
    expect(studentNotifications.unreadCount).toBeGreaterThanOrEqual(1);
    const gradeNotification = studentNotifications.notifications.find((n) => n.type === 'grade_posted');
    expect(gradeNotification).toBeTruthy();
    expect(gradeNotification!.title).toBe('Grade posted');

    await markNotificationRead(student, gradeNotification!.id);
    const afterRead = await listNotifications(student, { unreadOnly: true, page: 1, pageSize: 20 });
    expect(afterRead.notifications.some((n) => n.type === 'grade_posted')).toBe(false);
  });
});
