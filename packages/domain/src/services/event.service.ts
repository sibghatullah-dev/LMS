import mongoose, { type HydratedDocument } from 'mongoose';
import { EventModel, EventRegistrationModel, NotificationModel, UserModel } from '../models';
import type { Event } from '../models/event.model';
import type { AuthContext } from '../rbac/roles';
import { ForbiddenError, ConflictError, NotFoundError } from '../errors';
import { hasAnyRole } from '../rbac/roles';
import type { EventCreateInput, EventListQueryInput } from '../schemas/event.schema';
import { notifyUser } from './notification.service';

const { Types } = mongoose;

type EventDoc = HydratedDocument<Event>;

export interface PublicEvent {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  capacity?: number;
  location?: string;
  joinUrl?: string;
  status: Event['status'];
  createdById: string;
  registrationCount: number;
  registered: boolean;
  registeredAt?: string;
  createdAt?: string;
}

async function loadEvent(ctx: AuthContext, eventId: string): Promise<EventDoc> {
  if (!Types.ObjectId.isValid(eventId)) throw NotFoundError('Event not found.');
  const event = await EventModel.findOne({ _id: eventId, institutionId: ctx.institutionId });
  if (!event) throw NotFoundError('Event not found.');
  return event;
}

async function assertCanCreate(ctx: AuthContext): Promise<void> {
  if (hasAnyRole(ctx.role, ['admin', 'super_admin', 'instructor'])) return;
  throw ForbiddenError('You do not have access to create events.');
}

function toPublicEvent(event: EventDoc, registrationCount = 0, registeredAt?: Date | null): PublicEvent {
  return {
    id: String(event._id),
    title: event.title,
    description: event.description ?? '',
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    capacity: event.capacity ?? undefined,
    location: event.location ?? undefined,
    joinUrl: event.joinUrl ?? undefined,
    status: event.status,
    createdById: String(event.createdById),
    registrationCount,
    registered: Boolean(registeredAt),
    registeredAt: registeredAt?.toISOString(),
    createdAt: event.createdAt?.toISOString(),
  };
}

export async function createEvent(ctx: AuthContext, input: EventCreateInput): Promise<PublicEvent> {
  await assertCanCreate(ctx);
  const event = await EventModel.create({
    institutionId: ctx.institutionId,
    createdById: ctx.userId,
    title: input.title,
    description: input.description ?? '',
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    capacity: input.capacity,
    location: input.location,
    joinUrl: input.joinUrl,
    status: 'scheduled',
  });
  return toPublicEvent(event);
}

export async function listEvents(ctx: AuthContext, input: EventListQueryInput) {
  const now = new Date();
  const filter: Record<string, unknown> = { institutionId: ctx.institutionId, status: 'scheduled' };
  if (!input.includePast) filter.startsAt = { $gte: now };

  const [events, total, registrations] = await Promise.all([
    EventModel.find(filter)
      .sort({ startsAt: 1 })
      .skip((input.page - 1) * input.pageSize)
      .limit(input.pageSize),
    EventModel.countDocuments(filter),
    EventRegistrationModel.find({
      institutionId: ctx.institutionId,
      userId: ctx.userId,
      status: 'registered',
    }).select('eventId registeredAt'),
  ]);
  const registrationMap = new Map(
    registrations.map((registration) => [String(registration.eventId), registration.registeredAt ?? null]),
  );
  const counts = await EventRegistrationModel.aggregate<{ _id: unknown; count: number }>([
    { $match: { institutionId: new Types.ObjectId(ctx.institutionId), status: 'registered' } },
    { $group: { _id: '$eventId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((row) => [String(row._id), row.count]));

  return {
    events: events.map((event) => toPublicEvent(event, countMap.get(String(event._id)) ?? 0, registrationMap.get(String(event._id)))),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

async function assertCapacity(event: EventDoc) {
  if (event.capacity == null) return;
  const count = await EventRegistrationModel.countDocuments({
    eventId: event._id,
    status: 'registered',
  });
  if (count >= event.capacity) throw ConflictError('This event is full.');
}

export async function registerForEvent(ctx: AuthContext, eventId: string) {
  if (!['student', 'alumnus'].includes(ctx.role)) {
    throw ForbiddenError('Only students and alumni can register for events.');
  }
  const event = await loadEvent(ctx, eventId);
  if (event.status !== 'scheduled' || event.startsAt < new Date()) {
    throw ConflictError('This event is no longer available.');
  }

  const existing = await EventRegistrationModel.findOne({
    institutionId: ctx.institutionId,
    eventId: event._id,
    userId: ctx.userId,
  });
  if (existing?.status === 'registered') {
    throw ConflictError('You are already registered for this event.');
  }

  await assertCapacity(event);

  const registration =
    existing ??
    new EventRegistrationModel({
      institutionId: ctx.institutionId,
      eventId: event._id,
      userId: ctx.userId,
    });
  registration.status = 'registered';
  registration.registeredAt = new Date();
  registration.cancelledAt = undefined;
  await registration.save();

  await notifyUser({
    institutionId: ctx.institutionId,
    userId: ctx.userId,
    type: 'announcement',
    title: `Registered for ${event.title}`,
    body: `Your registration for ${event.title} is confirmed.`,
    actionUrl: '/events',
    relatedEntity: { type: 'event', id: event._id },
  });

  return { registered: true };
}

export async function createDueEventReminders(now = new Date()): Promise<{ created: number }> {
  const leadMs = 24 * 60 * 60_000;
  const events = await EventModel.find({
    status: 'scheduled',
    startsAt: { $gt: now, $lte: new Date(now.getTime() + leadMs) },
  }).select('institutionId title startsAt');

  let created = 0;
  for (const event of events) {
    const atLead = event.startsAt.getTime() - leadMs;
    if (atLead > now.getTime()) continue;
    const registrations = await EventRegistrationModel.find({
      institutionId: event.institutionId,
      eventId: event._id,
      status: 'registered',
    }).select('userId');
    const users = await UserModel.find({
      _id: { $in: registrations.map((registration) => registration.userId) },
      institutionId: event.institutionId,
    }).select('notificationPreferences');
    const prefsById = new Map(users.map((user) => [String(user._id), user.notificationPreferences]));

    const writes = registrations.map((registration) => {
      const prefs = prefsById.get(String(registration.userId));
      return {
        updateOne: {
          filter: {
            dedupeKey: `event-reminder:${String(event._id)}:${String(registration.userId)}`,
          },
          update: {
            $setOnInsert: {
              institutionId: event.institutionId,
              userId: registration.userId,
              type: 'event_reminder' as const,
              title: `Event starts in 24 hours`,
              body: `${event.title} starts at ${event.startsAt.toLocaleString()}.`,
              actionUrl: '/events',
              dedupeKey: `event-reminder:${String(event._id)}:${String(registration.userId)}`,
              relatedEntity: { type: 'event', id: event._id },
              channels: {
                inApp: (prefs?.inApp ?? true) ? 'sent' : 'skipped',
                email: (prefs?.email ?? true) ? 'pending' : 'skipped',
              },
            },
          },
          upsert: true,
        },
      };
    });

    if (writes.length > 0) {
      const result = await NotificationModel.bulkWrite(writes as never, { ordered: false });
      created += result.upsertedCount;
    }
  }

  return { created };
}
