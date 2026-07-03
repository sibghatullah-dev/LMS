# Software Requirements Specification (SRS)
## LearnSphere — Learning Management System

| | |
|---|---|
| **Document Version** | 1.0 |
| **Standard Basis** | Structured per IEEE 830 conventions |
| **Related Documents** | PRD, System Architecture Document, Database Design Document, API Specification, UI/UX Design Specification |

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements for LearnSphere, a web-based Learning Management System. It is intended for the engineering team (frontend, backend, QA) implementing the system in Next.js (frontend + backend/API) with MongoDB as the primary datastore, and for stakeholders validating that the build matches agreed scope.

### 1.2 Scope
LearnSphere supports five user roles — **Super Admin, Admin, Instructor, Student, Alumnus** — across course authoring, content delivery, live virtual classrooms, assessment/grading, collaboration, notifications, reporting, gamification, event management, and alumni access. Refer to PRD §5 for in-scope/out-of-scope boundaries.

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|---|---|
| LMS | Learning Management System |
| RBAC | Role-Based Access Control |
| SFU | Selective Forwarding Unit (WebRTC media routing architecture) |
| FR | Functional Requirement |
| NFR | Non-Functional Requirement |
| SSR | Server-Side Rendering |
| JWT | JSON Web Token |
| CRUD | Create, Read, Update, Delete |
| Cohort | A group of students enrolled together in a course instance with shared schedule |
| Drip content | Content released on a schedule rather than all at once |
| PWA | Progressive Web App |

### 1.4 References
- PRD — LearnSphere (v1.0)
- System Architecture Document — LearnSphere (v1.0)
- Database Design Document — LearnSphere (v1.0)
- OpenAPI Specification — LearnSphere (v1.0)

### 1.5 Overview
Section 2 describes the product context. Section 3 lists detailed functional requirements grouped by module, each with a unique ID (`FR-<MODULE>-<NUMBER>`). Section 4 specifies non-functional requirements (`NFR-<CATEGORY>-<NUMBER>`). Section 5 specifies external interface requirements. Section 6 documents key use cases.

---

## 2. Overall Description

### 2.1 Product Perspective
LearnSphere is a new, standalone, cloud-hosted product (not a modification of an existing legacy system). It is built as a **modular monolith** using Next.js for both the client application and the API layer (Route Handlers), backed by MongoDB, with a dedicated real-time media service for live classrooms. See the System Architecture Document for full component breakdown.

### 2.2 Product Functions (Summary)
1. Identity, authentication, and role-based authorization
2. Course authoring, structuring, and publishing (with approval workflow)
3. Enrollment management
4. Content delivery (video, audio, slideshow/document, downloadable resources)
5. Assignment, quiz/test creation, submission, and grading (rubric + weighted)
6. Live virtual classrooms (native + Zoom/MS Teams integration), recording, attendance
7. Discussion forums, Q&A, direct messaging, group/breakout channels
8. Notifications (in-app, email, SMS)
9. Student dashboards, gamification (badges, points, leaderboards)
10. Instructor dashboards and automated reporting
11. Admin dashboards, platform configuration, audit trail
12. Certificate generation
13. Event/webinar management
14. Alumni portal
15. Internationalization (language switching)

### 2.3 User Classes and Characteristics

| Role | Description | Technical Proficiency |
|---|---|---|
| **Super Admin** | Platform operator; manages institutions/tenants, global configuration | High |
| **Admin** | Institution-level manager; approves courses, manages users, views compliance reports | Medium |
| **Instructor** | Builds and teaches courses, grades work, runs live sessions | Medium |
| **Student** | Enrolls in and completes courses, submits work, attends live sessions | Low–Medium |
| **Alumnus** | Former student; read-mostly access to certificates, transcript, alumni network | Low |

### 2.4 Operating Environment
- **Client:** Modern evergreen browsers (Chrome, Edge, Safari, Firefox — last 2 major versions), responsive down to 360px mobile viewport width, installable as a PWA.
- **Server:** Node.js runtime (LTS) via Next.js server, deployed on Vercel (application layer) with an auxiliary Node.js media service for WebRTC SFU.
- **Database:** MongoDB Atlas (cloud-managed), Mongoose ODM.
- **Storage:** S3-compatible object storage for video/audio/document assets, fronted by a CDN.

### 2.5 Design and Implementation Constraints
- Frontend and backend must be implemented with **Next.js** (App Router, Route Handlers for API).
- Live classroom media must not be routed through Next.js serverless functions (stateful WebRTC connections require a persistent Node.js process — see SAD §3.3).
- Must support role-based access control enforced at the API layer, not just the UI.
- Must maintain an immutable audit log for grade changes, enrollment changes, and content publish/unpublish events.

### 2.6 Assumptions and Dependencies
- Reliable third-party services are available and contracted: email delivery (e.g., Resend/SendGrid), SMS delivery (e.g., Twilio), object storage/CDN (e.g., AWS S3 + CloudFront), and optionally Zoom/MS Teams developer API access.
- Institutions provide their own Zoom/MS Teams accounts if that integration path is used.

---

## 3. Functional Requirements

Each requirement is stated in the form: **The system shall...** Priority: **M**=Must, **S**=Should, **C**=Could (aligned to PRD MoSCoW).

### 3.1 Authentication & Authorization (AUTH)

| ID | Requirement | Priority |
|---|---|---|
| FR-AUTH-01 | The system shall allow a user to register with email, password, full name, and role-appropriate metadata, and shall verify the email address before full activation. | M |
| FR-AUTH-02 | The system shall allow login via email/password and issue a session using signed JWTs (access + refresh token pattern). | M |
| FR-AUTH-03 | The system shall support role assignment among Super Admin, Admin, Instructor, Student, and Alumnus, with a user able to hold exactly one primary role at a time (Instructors may additionally hold a Student sub-context if enrolled in another course). | M |
| FR-AUTH-04 | The system shall enforce role-based access control (RBAC) on every API endpoint, rejecting unauthorized requests with HTTP 403. | M |
| FR-AUTH-05 | The system shall support password reset via a time-limited, single-use emailed link. | M |
| FR-AUTH-06 | The system shall automatically transition a Student's role/status to Alumnus upon completion of all enrolled programs (configurable per institution), preserving their historical data. | S |
| FR-AUTH-07 | The system shall support optional OAuth login (Google) in addition to credentials-based login. | S |
| FR-AUTH-08 | The system shall lock an account after 5 consecutive failed login attempts for 15 minutes and notify the user by email. | S |
| FR-AUTH-09 | The system shall log all authentication events (login success/failure, password reset, role change) to the audit trail. | M |

### 3.2 Course Authoring & Management (COURSE)

| ID | Requirement | Priority |
|---|---|---|
| FR-COURSE-01 | The system shall allow an Instructor to create a course with title, description, category, cover image, language, and estimated duration. | M |
| FR-COURSE-02 | The system shall allow an Instructor to structure a course into an ordered hierarchy of Modules, each containing an ordered list of Lessons. | M |
| FR-COURSE-03 | The system shall support a drag-and-drop interface for reordering modules and lessons within the authoring UI. | M |
| FR-COURSE-04 | The system shall allow a Lesson to contain one or more content items of type: video, audio, slideshow/document, text/article, or downloadable file. | M |
| FR-COURSE-05 | The system shall allow an Instructor to save a course (or module) as a reusable **Template**, which can be cloned into a new course instance for a future cohort. | M |
| FR-COURSE-06 | The system shall support scheduled ("drip") release of modules/lessons based on a fixed date or an offset from the student's enrollment date. | M |
| FR-COURSE-07 | The system shall require Admin approval before a course transitions from `draft` to `published` status. | M |
| FR-COURSE-08 | The system shall allow an Admin to reject a submitted course with a required comment, returning it to `draft` status and notifying the Instructor. | M |
| FR-COURSE-09 | The system shall version course content such that edits to a published course do not retroactively alter the graded record of past cohorts (see DDD for versioning strategy). | S |
| FR-COURSE-10 | The system shall allow an Instructor to archive a course, hiding it from new enrollment while preserving access for already-enrolled students. | S |

### 3.3 Enrollment (ENROLL)

| ID | Requirement | Priority |
|---|---|---|
| FR-ENROLL-01 | The system shall allow a Student to self-enroll in any course marked as "open enrollment." | M |
| FR-ENROLL-02 | The system shall support "approval-required" enrollment, where a Student's enrollment request is queued for Instructor/Admin approval. | M |
| FR-ENROLL-03 | The system shall allow an Admin or Instructor to bulk-enroll students via a CSV upload or manual multi-select. | S |
| FR-ENROLL-04 | The system shall allow a Student to view all current and past enrollments with status (active, completed, dropped). | M |
| FR-ENROLL-05 | The system shall allow an Instructor to withdraw a student from a course, with a required reason logged to the audit trail. | S |
| FR-ENROLL-06 | The system shall enforce enrollment capacity limits when configured on a course/cohort. | C |

### 3.4 Content Delivery (CONTENT)

| ID | Requirement | Priority |
|---|---|---|
| FR-CONTENT-01 | The system shall stream uploaded video content using adaptive bitrate delivery suitable for varying network conditions. | M |
| FR-CONTENT-02 | The system shall support upload of video, audio, PDF, slide (PPT/PDF), and generic downloadable files up to a configurable size limit (default 2 GB for video, 100 MB for other files). | M |
| FR-CONTENT-03 | The system shall track per-student, per-lesson content consumption (e.g., % of video watched, document opened) to compute progress. | M |
| FR-CONTENT-04 | The system shall allow students 24/7 access to all released content, including recordings of past live sessions, for the duration of their enrollment (or per institution retention policy). | M |
| FR-CONTENT-05 | The system shall support embedding of gamified interactive content (e.g., embedded quizzes within a lesson) as a distinct content-item type. | C |

### 3.5 Assessment & Grading (ASSESS)

| ID | Requirement | Priority |
|---|---|---|
| FR-ASSESS-01 | The system shall allow an Instructor to create an Assignment with instructions, due date, maximum score, and allowed submission types (file upload, text entry, or both). | M |
| FR-ASSESS-02 | The system shall allow an Instructor to create a Quiz/Test composed of objective question types (multiple choice, true/false, matching) and subjective question types (free-text/essay). | M |
| FR-ASSESS-03 | The system shall auto-grade objective question types on submission. | M |
| FR-ASSESS-04 | The system shall route subjective (free-text/essay) answers and file-upload assignments to a manual grading queue for the Instructor. | M |
| FR-ASSESS-05 | The system shall support rubric-based grading, where an Instructor defines named criteria each with a point range, and per-criterion scores roll up to a total. | M |
| FR-ASSESS-06 | The system shall support weighted grading, where individual assignments/quizzes contribute a configurable percentage to a course's final grade. | M |
| FR-ASSESS-07 | The system shall allow bulk grading actions (e.g., apply a grade/comment template to multiple ungraded submissions). | S |
| FR-ASSESS-08 | The system shall notify a Student when a submission has been graded, including the score and instructor feedback. | M |
| FR-ASSESS-09 | The system shall enforce a submission deadline, flagging late submissions and applying a configurable late-penalty rule if defined. | S |
| FR-ASSESS-10 | The system shall allow a Student to view their full grade history and current standing per course. | M |

### 3.6 Live Virtual Classrooms (LIVE)

| ID | Requirement | Priority |
|---|---|---|
| FR-LIVE-01 | The system shall allow an Instructor to schedule a live session for a course/cohort, specifying date, time, duration, and delivery mode (native or Zoom/MS Teams). | M |
| FR-LIVE-02 | When delivery mode is "native," the system shall provide a browser-based WebRTC video/audio room supporting the Instructor and enrolled Students. | M |
| FR-LIVE-03 | When delivery mode is "Zoom" or "MS Teams," the system shall create the meeting via the respective provider's API and surface a one-click join link to enrolled students within LearnSphere. | M |
| FR-LIVE-04 | The system shall support live polls and quizzes launched by the Instructor during a native session, with real-time result aggregation visible to the Instructor. | S |
| FR-LIVE-05 | The system shall provide an interactive whiteboard tool during native sessions. | S |
| FR-LIVE-06 | The system shall provide in-session text chat during native sessions. | M |
| FR-LIVE-07 | The system shall support breakout rooms during native sessions, allowing the Instructor to split participants into sub-groups and recall them. | C |
| FR-LIVE-08 | The system shall record native sessions and store the recording for on-demand playback by enrolled students. | M |
| FR-LIVE-09 | For Zoom/MS Teams sessions, the system shall ingest the provider's recording (via webhook/API) and attach it to the corresponding LearnSphere session record, when the provider makes it available. | S |
| FR-LIVE-10 | The system shall automatically derive attendance records from a participant's join/leave timestamps and cumulative time-in-session during a native session, and from provider attendance reports for Zoom/MS Teams sessions. | M |
| FR-LIVE-11 | The system shall allow an Instructor to manually adjust an attendance record with a logged reason. | S |

### 3.7 Collaboration (COLLAB)

| ID | Requirement | Priority |
|---|---|---|
| FR-COLLAB-01 | The system shall provide a discussion forum per course, supporting threaded posts and replies. | M |
| FR-COLLAB-02 | The system shall provide a Q&A mode on forum threads, allowing an Instructor's reply to be marked as the "accepted answer." | S |
| FR-COLLAB-03 | The system shall support direct (1:1) messaging between users who share a course context. | M |
| FR-COLLAB-04 | The system shall support group/private channels for team-based coursework. | S |
| FR-COLLAB-05 | The system shall deliver new forum replies and direct messages as real-time in-app notifications. | M |

### 3.8 Notifications (NOTIFY)

| ID | Requirement | Priority |
|---|---|---|
| FR-NOTIFY-01 | The system shall deliver notifications via in-app, email, and SMS channels, per user-configurable preference per notification type. | M |
| FR-NOTIFY-02 | The system shall send automated reminders for upcoming assignment deadlines (configurable lead time, default 24 hours). | M |
| FR-NOTIFY-03 | The system shall send automated reminders for upcoming live sessions (default 15 minutes and 1 day prior). | M |
| FR-NOTIFY-04 | The system shall notify a Student immediately upon grade posting, enrollment approval/rejection, and course-level announcements from the Instructor. | M |
| FR-NOTIFY-05 | The system shall allow an Instructor or Admin to broadcast an announcement to all students in a course. | M |

### 3.9 Dashboards & Gamification (DASH)

| ID | Requirement | Priority |
|---|---|---|
| FR-DASH-01 | The system shall provide a Student dashboard summarizing upcoming deadlines, recent grades, active alerts, and per-course progress bars. | M |
| FR-DASH-02 | The system shall award points and badges for defined achievements (e.g., course completion, on-time submission streaks, forum participation). | S |
| FR-DASH-03 | The system shall display a per-course leaderboard ranking students by points, with an opt-out setting per student. | C |
| FR-DASH-04 | The system shall provide an Instructor dashboard summarizing per-course enrollment, average grades, attendance trends, and pending grading items. | M |
| FR-DASH-05 | The system shall provide an Admin dashboard summarizing platform-wide usage, pending course approvals, and compliance metrics. | M |
| FR-DASH-06 | The system shall allow Instructors and Admins to export dashboard reports (CSV/PDF). | S |

### 3.10 Certification (CERT)

| ID | Requirement | Priority |
|---|---|---|
| FR-CERT-01 | The system shall automatically generate a downloadable certificate (PDF) when a Student meets a course's configured completion criteria (e.g., minimum grade, minimum attendance). | M |
| FR-CERT-02 | The system shall assign each certificate a unique verification code, resolvable via a public verification URL. | S |

### 3.11 Events & Webinars (EVENT)

| ID | Requirement | Priority |
|---|---|---|
| FR-EVENT-01 | The system shall allow an Admin or Instructor to create a standalone Event/Webinar (distinct from a course's live sessions) with registration, capacity, and reminders. | S |
| FR-EVENT-02 | The system shall allow Students and Alumni to browse and register for upcoming events. | S |

### 3.12 Alumni (ALUMNI)

| ID | Requirement | Priority |
|---|---|---|
| FR-ALUMNI-01 | The system shall provide Alumni with persistent access to their certificates and full transcript after program completion. | S |
| FR-ALUMNI-02 | The system shall provide an opt-in Alumni directory searchable by graduating cohort, program, and (self-reported) industry. | C |

### 3.13 Administration & Audit (ADMIN)

| ID | Requirement | Priority |
|---|---|---|
| FR-ADMIN-01 | The system shall allow an Admin to create, edit, deactivate, and reassign roles for user accounts within their institution. | M |
| FR-ADMIN-02 | The system shall maintain an immutable audit log recording actor, action, target entity, before/after state (where applicable), and timestamp for: grade changes, enrollment changes, course publish/unpublish, role changes, and account deactivation. | M |
| FR-ADMIN-03 | The system shall allow an Admin to query and export the audit log filtered by date range, actor, or action type. | S |
| FR-ADMIN-04 | The system shall allow a Super Admin to manage institution-level (tenant) configuration, including branding basics, enabled features, and integration credentials (Zoom/MS Teams API keys). | M |

### 3.14 Internationalization (I18N)

| ID | Requirement | Priority |
|---|---|---|
| FR-I18N-01 | The system shall allow a user to switch the UI display language from a supported-language list. | C |
| FR-I18N-02 | The system architecture shall externalize all user-facing strings to enable adding further languages without code changes. | S |

---

## 4. Non-Functional Requirements

### 4.1 Performance (NFR-PERF)

| ID | Requirement |
|---|---|
| NFR-PERF-01 | 95th-percentile API response time shall be ≤ 500ms for non-media endpoints under nominal load (see SAD §6 for load assumptions). |
| NFR-PERF-02 | Video playback shall begin within 3 seconds of a user requesting a lesson, assuming a broadband connection ≥ 5 Mbps. |
| NFR-PERF-03 | The native live classroom shall support at least 100 concurrent participants per room at MVP launch, with the architecture designed to scale higher via additional SFU workers (see SAD). |
| NFR-PERF-04 | Dashboard pages shall achieve a Largest Contentful Paint (LCP) of ≤ 2.5 seconds on a simulated mid-tier mobile device. |

### 4.2 Scalability (NFR-SCALE)

| ID | Requirement |
|---|---|
| NFR-SCALE-01 | The system shall support horizontal scaling of the Next.js application tier (stateless request handling). |
| NFR-SCALE-02 | The database schema shall support at least 100,000 users and 10,000 concurrent course enrollments without redesign, per the indexing strategy in the DDD. |
| NFR-SCALE-03 | Media storage and delivery shall scale via CDN and object storage without impacting application-tier performance. |

### 4.3 Availability & Reliability (NFR-AVAIL)

| ID | Requirement |
|---|---|
| NFR-AVAIL-01 | The system shall target 99.5% monthly uptime for the core application (excluding scheduled maintenance windows). |
| NFR-AVAIL-02 | The system shall degrade gracefully if the live-media service is unavailable — scheduled sessions shall display a clear status and fallback instructions rather than a hard failure. |
| NFR-AVAIL-03 | Automated daily backups of the database shall be retained for a minimum of 30 days with tested restore procedures. |

### 4.4 Security (NFR-SEC)

| ID | Requirement |
|---|---|
| NFR-SEC-01 | All traffic shall be served over TLS 1.2+. |
| NFR-SEC-02 | Passwords shall be hashed using a modern adaptive algorithm (bcrypt or argon2) with per-user salt; plaintext passwords shall never be logged or stored. |
| NFR-SEC-03 | All API endpoints shall enforce authentication and RBAC authorization server-side, independent of client-side UI restrictions. |
| NFR-SEC-04 | The system shall protect against common web vulnerabilities (OWASP Top 10): injection, broken auth, XSS, CSRF, insecure deserialization, etc. |
| NFR-SEC-05 | File uploads shall be validated (type, size, virus/malware scan where feasible) before storage. |
| NFR-SEC-06 | Sensitive data at rest (PII, grades) shall be encrypted using provider-managed encryption at rest at minimum (MongoDB Atlas encryption, S3 SSE). |
| NFR-SEC-07 | API rate limiting shall be applied per user/IP to mitigate abuse and brute-force attempts. |

### 4.5 Privacy & Compliance (NFR-PRIV)

| ID | Requirement |
|---|---|
| NFR-PRIV-01 | The system shall support data-subject access and deletion requests consistent with GDPR-style principles (export and erasure of a user's personal data on request, subject to legitimate record-keeping exceptions such as academic transcripts). |
| NFR-PRIV-02 | The system shall restrict access to student educational records to roles with a legitimate need (Instructor of record, Admin), consistent with FERPA-style access principles. |
| NFR-PRIV-03 | The audit trail (FR-ADMIN-02) shall itself be immutable and access-restricted to Admin/Super Admin roles. |

### 4.6 Usability & Accessibility (NFR-USE)

| ID | Requirement |
|---|---|
| NFR-USE-01 | The UI shall conform to WCAG 2.1 AA guidelines for color contrast, keyboard navigation, and screen-reader labeling. |
| NFR-USE-02 | The UI shall be fully responsive from 360px (mobile) to large desktop breakpoints. |
| NFR-USE-03 | Core student tasks (view deadline, submit assignment, join live class) shall be completable within 3 taps/clicks from the dashboard. |

### 4.7 Maintainability (NFR-MAINT)

| ID | Requirement |
|---|---|
| NFR-MAINT-01 | The codebase shall use TypeScript across frontend and backend to reduce runtime type errors. |
| NFR-MAINT-02 | The system shall maintain automated test coverage for critical business logic (grading calculations, enrollment state transitions, RBAC checks) of at least 70%. |
| NFR-MAINT-03 | API contracts shall be documented and kept in sync via the OpenAPI Specification. |

---

## 5. External Interface Requirements

### 5.1 User Interfaces
Specified in full in the **UI/UX Design Specification Document**: responsive web application with role-specific dashboards (Student, Instructor, Admin), course authoring workspace, live classroom interface, and public course catalog.

### 5.2 Hardware Interfaces
None beyond standard client device peripherals (camera/microphone for live sessions, required only on the participant side; no specialized hardware).

### 5.3 Software Interfaces

| Interface | Purpose |
|---|---|
| MongoDB Atlas | Primary datastore |
| AWS S3 (or compatible) | Object storage for video/audio/documents |
| CDN (e.g., CloudFront) | Content delivery for static assets and video |
| Zoom API / Microsoft Graph API (Teams) | Live session creation, join links, recording retrieval |
| Email provider API (e.g., Resend/SendGrid) | Transactional email delivery |
| SMS provider API (e.g., Twilio) | SMS notification delivery |
| Redis | Caching, job queue (BullMQ), pub/sub for real-time features |
| WebRTC SFU service (custom, e.g., mediasoup) | Native live classroom media routing |

### 5.4 Communication Interfaces
- REST/JSON over HTTPS for all client-server API communication (see API Specification).
- WebSocket (Socket.io) for real-time chat, notifications, and live-session signaling.
- Webhooks (inbound) from Zoom/MS Teams for recording-ready and meeting-ended events.

---

## 6. Key Use Cases (Illustrative)

### UC-01: Student Submits an Assignment
- **Actor:** Student
- **Preconditions:** Student is enrolled in the course; assignment is published and not past its hard deadline (or late submission is allowed).
- **Main Flow:**
  1. Student navigates to the assignment from the course page or dashboard.
  2. Student uploads a file and/or enters text response.
  3. System validates file type/size and stores the submission, timestamped.
  4. If past the soft deadline, system flags the submission as late per FR-ASSESS-09.
  5. System notifies the Instructor of a new submission pending grading.
- **Postconditions:** Submission is recorded; visible in the Instructor's grading queue.

### UC-02: Instructor Runs a Native Live Session
- **Actor:** Instructor, Students
- **Preconditions:** Session is scheduled with delivery mode = native.
- **Main Flow:**
  1. Instructor starts the session at the scheduled time; the system initializes a WebRTC room via the media service.
  2. Enrolled students join via a link surfaced on their dashboard; the system begins tracking join timestamps.
  3. Instructor launches a poll; responses aggregate in real time.
  4. Instructor ends the session; the system finalizes the recording and computes attendance from join/leave events.
- **Postconditions:** Recording is available on-demand; attendance records are created for all participants.

### UC-03: Admin Approves a New Course
- **Actor:** Admin, Instructor
- **Preconditions:** Instructor has submitted a course for review (status = `pending_review`).
- **Main Flow:**
  1. Admin opens the pending-review queue and inspects the course structure/content.
  2. Admin approves → course status becomes `published`, visible in the catalog; Instructor is notified.
     - Alternate: Admin rejects with a comment → status reverts to `draft`; Instructor is notified with feedback.
- **Postconditions:** Course is either live for enrollment or returned to the Instructor for revision; action is recorded in the audit trail.

### UC-04: Student Completes a Course and Becomes an Alumnus
- **Actor:** Student
- **Preconditions:** Student meets the course's completion criteria (grade + attendance thresholds).
- **Main Flow:**
  1. System detects completion criteria met upon final grade posting.
  2. System generates a certificate PDF with a unique verification code.
  3. If this was the student's last active enrollment, the system updates their role/status to Alumnus (FR-AUTH-06) while preserving all historical records.
- **Postconditions:** Certificate available for download; Alumni portal access granted.

---
*End of Software Requirements Specification.*
