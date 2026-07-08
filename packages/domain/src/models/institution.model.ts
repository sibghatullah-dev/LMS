import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { INSTITUTION_PLANS } from '@lumora/config';

// mongoose is CommonJS; destructure from the default import so this resolves
// under both the Next.js bundler and native ESM (tsx worker/seed scripts).
const { Schema, model, models } = mongoose;

/**
 * `institutions` collection (DDD §3.1). Tenant record: profile, plan, feature
 * flags, and references to integration credentials (never raw secrets — those
 * live in the secret manager; we store *references*).
 */
const institutionSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    plan: { type: String, enum: INSTITUTION_PLANS, default: 'trial' },
    branding: {
      logoUrl: { type: String },
      primaryColor: { type: String },
    },
    featureFlags: {
      nativeLiveClassroom: { type: Boolean, default: true },
      zoomIntegration: { type: Boolean, default: false },
      teamsIntegration: { type: Boolean, default: false },
      alumniPortal: { type: Boolean, default: true },
      gamification: { type: Boolean, default: true },
    },
    integrationCredentials: {
      zoom: { apiKeyRef: String, apiSecretRef: String },
      msTeams: { clientIdRef: String, clientSecretRef: String },
    },
  },
  { timestamps: true, collection: 'institutions' },
);

export type Institution = InferSchemaType<typeof institutionSchema>;

export const InstitutionModel: Model<Institution> =
  (models.Institution as Model<Institution>) ?? model<Institution>('Institution', institutionSchema);
