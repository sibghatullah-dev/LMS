import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { NOTIFICATION_CHANNEL_STATUSES, NOTIFICATION_TYPES } from '@lumora/config';

const { Schema, model, models } = mongoose;

const notificationSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    actionUrl: { type: String },
    dedupeKey: { type: String },
    relatedEntity: {
      type: { type: String },
      id: { type: Schema.Types.ObjectId },
    },
    readAt: { type: Date },
    channels: {
      inApp: { type: String, enum: NOTIFICATION_CHANNEL_STATUSES, default: 'pending' },
      email: { type: String, enum: NOTIFICATION_CHANNEL_STATUSES, default: 'pending' },
    },
    emailError: { type: String },
    emailSentAt: { type: Date },
  },
  { timestamps: true, collection: 'notifications' },
);

notificationSchema.index({ institutionId: 1, userId: 1, createdAt: -1 });
notificationSchema.index({ institutionId: 1, userId: 1, readAt: 1 });
notificationSchema.index({ 'channels.email': 1, createdAt: 1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

export type Notification = InferSchemaType<typeof notificationSchema>;

export const NotificationModel: Model<Notification> =
  (models.Notification as Model<Notification>) ??
  model<Notification>('Notification', notificationSchema);
