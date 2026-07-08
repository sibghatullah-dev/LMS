import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

const eventSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    capacity: { type: Number },
    location: { type: String },
    joinUrl: { type: String },
    status: { type: String, enum: ['scheduled', 'cancelled', 'completed'], default: 'scheduled' },
  },
  { timestamps: true, collection: 'events' },
);

eventSchema.index({ institutionId: 1, startsAt: 1 });
eventSchema.index({ institutionId: 1, status: 1, startsAt: 1 });

export type Event = InferSchemaType<typeof eventSchema>;

export const EventModel: Model<Event> =
  (models.Event as Model<Event>) ?? model<Event>('Event', eventSchema);
