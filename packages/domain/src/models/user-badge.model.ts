import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

/** `user_badges` collection (DDD §3.13, FR-DASH-02). */
const userBadgeSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    badgeId: { type: Schema.Types.ObjectId, ref: 'Badge', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
    awardedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true, collection: 'user_badges' },
);

userBadgeSchema.index({ userId: 1, badgeId: 1, courseId: 1 }, { unique: true });
userBadgeSchema.index({ institutionId: 1, userId: 1, awardedAt: -1 });

export type UserBadge = InferSchemaType<typeof userBadgeSchema>;

export const UserBadgeModel: Model<UserBadge> =
  (models.UserBadge as Model<UserBadge>) ?? model<UserBadge>('UserBadge', userBadgeSchema);
