import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import {
  CONTENT_ITEM_TYPES,
  COURSE_STATUSES,
  ENROLLMENT_MODES,
  RELEASE_RULE_TYPES,
} from '@lumora/config';

const { Schema, model, models } = mongoose;

/**
 * `courses` collection (DDD §3.3). Modules → lessons → content items are
 * **embedded**: they are structural, bounded in count, and always read together
 * with the course when a student views the syllabus. High-write, per-student data
 * (progress, submissions) lives in separate collections that reference the course.
 */
const contentItemSchema = new Schema(
  {
    type: { type: String, enum: CONTENT_ITEM_TYPES, required: true },
    title: { type: String, required: true },
    storageKey: { type: String }, // S3 object key for media/document types
    streamingManifestUrl: { type: String }, // HLS/DASH manifest, video only
    textBody: { type: String }, // for "article" type
    linkedAssessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment' }, // embedded_quiz
    durationSeconds: { type: Number }, // video/audio only
    order: { type: Number, required: true },
  },
  { _id: true },
);

const lessonSchema = new Schema(
  {
    title: { type: String, required: true },
    order: { type: Number, required: true },
    contentItems: { type: [contentItemSchema], default: [] },
  },
  { _id: true },
);

const moduleSchema = new Schema(
  {
    title: { type: String, required: true },
    order: { type: Number, required: true },
    releaseRule: {
      type: { type: String, enum: RELEASE_RULE_TYPES, default: 'immediate' },
      date: { type: Date }, // when type = fixed_date
      offsetDays: { type: Number }, // when type = offset_from_enrollment
    },
    lessons: { type: [lessonSchema], default: [] },
  },
  { _id: true },
);

const courseSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    instructorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String },
    coverImageUrl: { type: String },
    language: { type: String, default: 'en' },
    estimatedDurationHours: { type: Number },
    status: { type: String, enum: COURSE_STATUSES, default: 'draft', required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewComment: { type: String },
    enrollmentMode: { type: String, enum: ENROLLMENT_MODES, default: 'open' },
    enrollmentCapacity: { type: Number }, // null/undefined = unlimited
    isTemplate: { type: Boolean, default: false },
    clonedFromCourseId: { type: Schema.Types.ObjectId, ref: 'Course' },
    completionCriteria: {
      minGradePercent: { type: Number, default: 0 },
      minAttendancePercent: { type: Number, default: 0 },
    },
    modules: { type: [moduleSchema], default: [] },
    version: { type: Number, default: 1 },
    publishedAt: { type: Date },
    archivedAt: { type: Date },
  },
  { timestamps: true, collection: 'courses' },
);

// Indexes (DDD §3.3).
courseSchema.index({ institutionId: 1, status: 1 });
courseSchema.index({ institutionId: 1, slug: 1 }, { unique: true });
courseSchema.index({ instructorId: 1 });
courseSchema.index({ title: 'text', description: 'text' }); // catalog search

export type Course = InferSchemaType<typeof courseSchema>;
export type CourseModule = InferSchemaType<typeof moduleSchema>;
export type Lesson = InferSchemaType<typeof lessonSchema>;
export type ContentItem = InferSchemaType<typeof contentItemSchema>;

export const CourseModel: Model<Course> =
  (models.Course as Model<Course>) ?? model<Course>('Course', courseSchema);
