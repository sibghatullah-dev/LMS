import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

/** `badges` collection (DDD §3.13, FR-DASH-02). */
const badgeSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'award' },
    points: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'badges' },
);

badgeSchema.index({ institutionId: 1, code: 1 }, { unique: true });

export type Badge = InferSchemaType<typeof badgeSchema>;

export const BadgeModel: Model<Badge> =
  (models.Badge as Model<Badge>) ?? model<Badge>('Badge', badgeSchema);
