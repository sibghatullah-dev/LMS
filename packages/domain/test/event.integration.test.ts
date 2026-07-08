import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  EventModel,
  EventRegistrationModel,
  InstitutionModel,
  NotificationModel,
  UserModel,
} from '../src/models';
import type { AuthContext } from '../src/rbac/roles';
import { createDueEventReminders } from '../src/services/event.service';
import { createEvent, listEvents, registerForEvent } from '../src/services/event.service';

let seq = 0;

async function makeInstitution(slug: string) {
  const inst = await InstitutionModel.create({ name: slug, slug });
  return String(inst._id);
}

async function makeUser(institutionId: string, role: AuthContext['role']): Promise<AuthContext> {
  const u = await UserModel.create({
    institutionId,
    email: `${role}-${seq++}@x.com`,
    fullName: `${role} ${seq}`,
    role,
    status: 'active',
  });
  return { userId: String(u._id), institutionId, role };
}

let institutionId: string;
let admin: AuthContext;
let student: AuthContext;

beforeAll(async () => {
  await Promise.all([
    EventModel.createIndexes(),
    EventRegistrationModel.createIndexes(),
    NotificationModel.createIndexes(),
  ]);
});

beforeEach(async () => {
  institutionId = await makeInstitution('lumora-events');
  admin = await makeUser(institutionId, 'admin');
  student = await makeUser(institutionId, 'student');
});

describe('events phase', () => {
  it('creates events, lists them, registers users, and sends reminders', async () => {
    const now = new Date('2030-01-01T10:00:00Z');
    const created = await createEvent(admin, {
      title: 'Career Webinar',
      description: 'Intro to the industry.',
      startsAt: new Date(now.getTime() + 24 * 60 * 60_000),
      endsAt: new Date(now.getTime() + 25 * 60 * 60_000),
      capacity: 50,
      location: 'Zoom',
      joinUrl: 'https://zoom.example.com/j/123',
    });
    expect(created.title).toBe('Career Webinar');

    const listed = await listEvents(student, { includePast: false, page: 1, pageSize: 20 });
    expect(listed.events[0]?.id).toBe(created.id);

    const registered = await registerForEvent(student, created.id);
    expect(registered.registered).toBe(true);

    const reminders = await createDueEventReminders(now);
    expect(reminders.created).toBeGreaterThan(0);

    const notification = await NotificationModel.findOne({
      institutionId,
      userId: student.userId,
      type: 'event_reminder',
    }).lean();
    expect(notification).toBeTruthy();
  });
});
