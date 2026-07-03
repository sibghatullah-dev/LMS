import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

const certificateSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    verificationCode: { type: String, required: true },
    storageKey: { type: String, required: true },
    issuedAt: { type: Date, required: true },
    finalGradePercent: { type: Number, required: true },
  },
  { timestamps: true, collection: 'certificates' },
);

certificateSchema.index({ verificationCode: 1 }, { unique: true });
certificateSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
certificateSchema.index({ institutionId: 1, studentId: 1, issuedAt: -1 });

export type Certificate = InferSchemaType<typeof certificateSchema>;

export const CertificateModel: Model<Certificate> =
  (models.Certificate as Model<Certificate>) ??
  model<Certificate>('Certificate', certificateSchema);
