/** Shared, non-secret constants used across web / worker / domain. */

/** User roles (SRS §1.2, DDD users.role enum). */
export const ROLES = ['super_admin', 'admin', 'instructor', 'student', 'alumnus'] as const;
export type Role = (typeof ROLES)[number];

/** Auth (FR-AUTH-08). */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const ACCOUNT_LOCK_MINUTES = 15;

/** Email verification / password reset token lifetimes (FR-AUTH-01, FR-AUTH-05). */
export const EMAIL_VERIFICATION_TTL_HOURS = 24;
export const PASSWORD_RESET_TTL_MINUTES = 30;

/**
 * Default institution slug used when a self-registering user does not specify one
 * (single-tenant MVP posture — plan §1.3). The seed script creates this tenant.
 */
export const DEFAULT_INSTITUTION_SLUG = 'lumora';

/** Institution plan tiers (DDD §3.1). */
export const INSTITUTION_PLANS = ['trial', 'starter', 'growth', 'enterprise'] as const;
export type InstitutionPlan = (typeof INSTITUTION_PLANS)[number];

/** User account lifecycle status (DDD §3.2). */
export const USER_STATUSES = [
  'pending_verification',
  'active',
  'suspended',
  'deactivated',
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Auth providers a user account can carry (DDD §3.2 authProviders). */
export const AUTH_PROVIDERS = ['credentials', 'google'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

/** Notification lead times (FR-NOTIFY-02/03), in minutes. */
export const DEADLINE_REMINDER_LEAD_MIN = 24 * 60; // 24h default
export const SESSION_REMINDER_LEADS_MIN = [15, 24 * 60]; // 15 min + 1 day
export const EVENT_REMINDER_LEADS_MIN = [24 * 60]; // 1 day before event start

/** Course lifecycle status (DDD §3.3). Reject returns a course to `draft` (UC-03). */
export const COURSE_STATUSES = [
  'draft',
  'pending_review',
  'published',
  'rejected',
  'archived',
] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

/** Enrollment modes for a course (FR-ENROLL-01/02). */
export const ENROLLMENT_MODES = ['open', 'approval_required'] as const;
export type EnrollmentMode = (typeof ENROLLMENT_MODES)[number];

/** Content item types within a lesson (DDD §3.3, FR-CONTENT). */
export const CONTENT_ITEM_TYPES = [
  'video',
  'audio',
  'document',
  'article',
  'downloadable',
  'embedded_quiz',
] as const;
export type ContentItemType = (typeof CONTENT_ITEM_TYPES)[number];

/** Module drip-release rule types (FR-COURSE-06). */
export const RELEASE_RULE_TYPES = ['immediate', 'fixed_date', 'offset_from_enrollment'] as const;
export type ReleaseRuleType = (typeof RELEASE_RULE_TYPES)[number];

/** Per-lesson consumption status (DDD §3.5, FR-CONTENT-03). */
export const LESSON_PROGRESS_STATUSES = ['not_started', 'in_progress', 'completed'] as const;
export type LessonProgressStatus = (typeof LESSON_PROGRESS_STATUSES)[number];

/** % consumed at/above which a media lesson auto-completes (FR-CONTENT-03). */
export const LESSON_COMPLETE_THRESHOLD_PERCENT = 95;

/** Assessment lifecycle and grading constants (DDD §3.6/3.7, FR-ASSESS). */
export const ASSESSMENT_TYPES = ['assignment', 'quiz'] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export const ASSESSMENT_STATUSES = ['draft', 'published', 'closed'] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const SUBMISSION_TYPES = ['file', 'text'] as const;
export type SubmissionType = (typeof SUBMISSION_TYPES)[number];

export const QUESTION_TYPES = ['multiple_choice', 'true_false', 'matching', 'essay'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const SUBMISSION_STATUSES = ['submitted', 'auto_graded', 'grading', 'graded'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Notification lifecycle (FR-NOTIFY). */
export const NOTIFICATION_TYPES = [
  'grade_posted',
  'submission_received',
  'enrollment_status',
  'course_review',
  'announcement',
  'forum_reply',
  'direct_message',
  'event_reminder',
  'deadline_reminder',
  'live_session_reminder',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNEL_STATUSES = ['pending', 'sent', 'failed', 'skipped'] as const;
export type NotificationChannelStatus = (typeof NOTIFICATION_CHANNEL_STATUSES)[number];

/** Live classroom scheduling (FR-LIVE). */
export const LIVE_SESSION_DELIVERY_MODES = ['native', 'zoom', 'ms_teams'] as const;
export type LiveSessionDeliveryMode = (typeof LIVE_SESSION_DELIVERY_MODES)[number];

export const LIVE_SESSION_STATUSES = ['scheduled', 'live', 'ended', 'cancelled'] as const;
export type LiveSessionStatus = (typeof LIVE_SESSION_STATUSES)[number];

export const ATTENDANCE_SOURCES = ['native', 'provider', 'manual'] as const;
export type AttendanceSource = (typeof ATTENDANCE_SOURCES)[number];

/** Enrollment lifecycle status (DDD §3.4, FR-ENROLL). */
export const ENROLLMENT_STATUSES = [
  'pending_approval',
  'active',
  'completed',
  'dropped',
  'rejected',
] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

/** BullMQ queue names (SAD §4.5). */
export const QUEUE_NAMES = {
  notifications: 'notifications',
  transcode: 'transcode',
  certificates: 'certificates',
  reports: 'reports',
  webhooks: 'webhooks',
} as const;

/** Redis cache TTLs (seconds) for read aggregates (SAD §7). */
export const CACHE_TTL = {
  dashboard: 60,
  leaderboard: 120,
} as const;
