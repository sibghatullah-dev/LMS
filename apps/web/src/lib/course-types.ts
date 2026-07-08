/** Client-side course types (mirror domain PublicCourse / CourseCard). */
export interface CourseCard {
  id: string;
  title: string;
  slug: string;
  description: string;
  category?: string;
  status: string;
  isTemplate: boolean;
  moduleCount: number;
  lessonCount: number;
  enrollmentMode: string;
}

export interface ContentItem {
  id?: string;
  type: 'video' | 'audio' | 'document' | 'article' | 'downloadable' | 'embedded_quiz';
  title: string;
  textBody?: string;
  storageKey?: string;
}

export interface Lesson {
  id?: string;
  title: string;
  contentItems: ContentItem[];
}

export interface Module {
  id?: string;
  title: string;
  order?: number;
  releaseRule?: { type: 'immediate' | 'fixed_date' | 'offset_from_enrollment'; offsetDays?: number };
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: string;
  reviewComment?: string;
  enrollmentMode: string;
  isTemplate: boolean;
  modules: Module[];
}

export interface RubricCriterion {
  criterion: string;
  maxPoints: number;
  description?: string;
}

export interface QuizQuestion {
  _id?: string;
  id?: string;
  questionType: 'multiple_choice' | 'true_false' | 'matching' | 'essay';
  prompt: string;
  options: string[];
  correctAnswer?: string | string[];
  points: number;
}

export interface Assessment {
  id: string;
  courseId: string;
  type: 'assignment' | 'quiz';
  title: string;
  instructions: string;
  dueAt?: string;
  allowLateSubmission: boolean;
  latePenaltyPercentPerDay?: number;
  maxScore: number;
  weightPercent: number;
  submissionTypes: ('file' | 'text')[];
  rubric: RubricCriterion[];
  questions: QuizQuestion[];
  status: 'draft' | 'published' | 'closed';
  revisionOf?: string;
}

export interface Submission {
  id: string;
  assessmentId: string;
  courseId: string;
  studentId: string;
  submittedAt: string;
  isLate: boolean;
  status: 'submitted' | 'auto_graded' | 'grading' | 'graded';
  totalScore: number | null;
  totalScorePercent: number | null;
  instructorComment: string | null;
  rubricScores: { criterion: string; pointsAwarded: number; comment?: string }[];
  gradedAt: string | null;
}

export interface LiveSession {
  id: string;
  courseId: string;
  instructorId: string;
  title: string;
  description: string;
  scheduledStart: string;
  scheduledEnd: string;
  deliveryMode: 'native' | 'zoom' | 'ms_teams';
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  joinUrl?: string;
  providerMeetingId?: string;
  providerRecordingUrl?: string;
  recordingStorageKey?: string;
  recordingStatus?: 'not_available' | 'processing' | 'available' | 'failed';
  recordingError?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  courseId: string;
  liveSessionId: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  joinedAt?: string;
  leftAt?: string;
  durationSeconds: number;
  present: boolean;
  source: 'native' | 'provider' | 'manual';
  overrideReason?: string;
}

export interface LivePoll {
  id: string;
  liveSessionId: string;
  question: string;
  options: string[];
  counts: number[];
  responseCount: number;
  closedAt?: string;
  createdAt?: string;
}

export interface LiveChatMessage {
  id: string;
  liveSessionId: string;
  senderId: string;
  senderName?: string;
  senderRole?: string;
  body: string;
  createdAt?: string;
}

export interface LiveWhiteboardEvent {
  id: string;
  liveSessionId: string;
  kind: 'stroke' | 'clear';
  color?: string;
  width?: number;
  points: { x: number; y: number }[];
  createdBy: string;
  createdAt?: string;
}

export interface LiveBreakoutRoom {
  id: string;
  liveSessionId: string;
  name: string;
  participantIds: string[];
  recalledAt?: string;
}

export const STATUS_TONE: Record<string, 'neutral' | 'progress' | 'live' | 'alert'> = {
  draft: 'neutral',
  pending_review: 'progress',
  published: 'live',
  archived: 'neutral',
  rejected: 'alert',
};
