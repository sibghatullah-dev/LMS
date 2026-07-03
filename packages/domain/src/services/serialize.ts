import type { HydratedDocument } from 'mongoose';
import type { User } from '../models/user.model';

/** Public shape of a user returned by the API — never includes secrets. */
export interface PublicUser {
  id: string;
  institutionId: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: string;
  status: string;
  emailVerified: boolean;
  locale: string;
  notificationPreferences: { email: boolean; sms: boolean; inApp: boolean };
  gamification: { totalPoints: number; leaderboardOptOut: boolean };
  createdAt?: Date;
  lastLoginAt?: Date;
}

/**
 * Map a user document to its public representation, stripping passwordHash,
 * security tokens, and other internal fields (NFR-SEC-02, NFR-PRIV-02).
 */
export function toPublicUser(doc: HydratedDocument<User>): PublicUser {
  return {
    id: String(doc._id),
    institutionId: String(doc.institutionId),
    email: doc.email,
    fullName: doc.fullName,
    avatarUrl: doc.avatarUrl ?? undefined,
    role: doc.role,
    status: doc.status,
    emailVerified: Boolean(doc.emailVerifiedAt),
    locale: doc.locale ?? 'en',
    notificationPreferences: {
      email: doc.notificationPreferences?.email ?? true,
      sms: doc.notificationPreferences?.sms ?? false,
      inApp: doc.notificationPreferences?.inApp ?? true,
    },
    gamification: {
      totalPoints: doc.gamification?.totalPoints ?? 0,
      leaderboardOptOut: doc.gamification?.leaderboardOptOut ?? false,
    },
    createdAt: (doc as { createdAt?: Date }).createdAt,
    lastLoginAt: doc.lastLoginAt ?? undefined,
  };
}
