import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { AUTH_PROVIDERS, ROLES, USER_STATUSES } from '@lumora/config';

const { Schema, model, models } = mongoose;

/**
 * `users` collection (DDD §3.2). All roles live here; role transitions (e.g.
 * student → alumnus, FR-AUTH-06) mutate `role` in place while preserving history.
 *
 * Implementation-only fields not in the DDD domain shape are grouped under
 * `security` (verification/reset token hashes, refresh-token invalidation) so the
 * documented domain fields stay clean. MongoDB $jsonSchema does not forbid extra
 * properties, so this is compatible with the DB-level validator (DDD §1.2).
 */
const userSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String }, // null when OAuth-only
    authProviders: { type: [String], enum: AUTH_PROVIDERS, default: ['credentials'] },
    fullName: { type: String, required: true },
    avatarUrl: { type: String },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: USER_STATUSES, default: 'pending_verification' },
    emailVerifiedAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    locale: { type: String, default: 'en' },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      inApp: { type: Boolean, default: true },
    },
    gamification: {
      totalPoints: { type: Number, default: 0 },
      leaderboardOptOut: { type: Boolean, default: false },
    },
    alumniProfile: {
      graduationCohort: { type: String },
      industry: { type: String },
      directoryOptIn: { type: Boolean },
    },
    // Invalidates all outstanding refresh tokens when incremented (logout / reset).
    tokenVersion: { type: Number, default: 0 },
    security: {
      emailVerificationTokenHash: { type: String },
      emailVerificationExpiresAt: { type: Date },
      passwordResetTokenHash: { type: String },
      passwordResetExpiresAt: { type: Date },
    },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, collection: 'users' },
);

// Indexes (DDD §3.2). Email is unique *per institution*.
userSchema.index({ institutionId: 1, email: 1 }, { unique: true });
userSchema.index({ institutionId: 1, role: 1 });
userSchema.index(
  { 'alumniProfile.directoryOptIn': 1 },
  { sparse: true },
);

export type User = InferSchemaType<typeof userSchema>;

export const UserModel: Model<User> =
  (models.User as Model<User>) ?? model<User>('User', userSchema);
