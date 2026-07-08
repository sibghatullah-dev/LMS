import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

const eventRegistrationSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['registered', 'cancelled'], default: 'registered' },
    registeredAt: { type: Date, default: () => new Date() },
    cancelledAt: { type: Date },
  },
  { timestamps: true, collection: 'event_registrations' },
);

eventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });
eventRegistrationSchema.index({ institutionId: 1, eventId: 1, status: 1 });

export type EventRegistration = InferSchemaType<typeof eventRegistrationSchema>;

export const EventRegistrationModel: Model<EventRegistration> =
  (models.EventRegistration as Model<EventRegistration>) ??
  model<EventRegistration>('EventRegistration', eventRegistrationSchema);
