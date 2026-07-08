import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

/** `point_events` collection (FR-DASH-02/03). */
const pointEventSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
    reason: { type: String, required: true },
    points: { type: Number, required: true },
    dedupeKey: { type: String, required: true },
  },
  { timestamps: true, collection: 'point_events' },
);

pointEventSchema.index({ dedupeKey: 1 }, { unique: true });
pointEventSchema.index({ institutionId: 1, courseId: 1, points: -1 });
pointEventSchema.index({ institutionId: 1, userId: 1, createdAt: -1 });

export type PointEvent = InferSchemaType<typeof pointEventSchema>;

export const PointEventModel: Model<PointEvent> =
  (models.PointEvent as Model<PointEvent>) ?? model<PointEvent>('PointEvent', pointEventSchema);
