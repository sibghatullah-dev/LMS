# Implementation Plan
## LearnSphere — Learning Management System

| | |
|---|---|
| **Document Version** | 1.6 (Approved — build in progress) |
| **Status** | Approved. Product name = **Lumora** (O-7). **Phases 0–8 have real implementations** (Identity, Courses, Enrollment, Content, Assessment/Grading, Dashboards, Notifications, Certificates) — further along than sequential phase tracking suggested. A full architecture audit (3 parallel subsystem reviews + live HTTP verification) found and fixed **2 critical grading/certification-integrity bugs** and **4 high-severity bugs** (incl. an unauthenticated cross-tenant certificate PDF leak), added 9 regression tests (71 passing, up from 62), and wired real SMTP email delivery (previously console-only). Known deferred gaps (Redis-backed rate limiting, deadline/session reminder scheduling, attendance-gated completion) are documented, not silently missing. |
| **Prepared For** | Solo developer build |
| **Related Documents** | 01_PRD, 02_SRS, 03_SAD, 04_DDD, 05_API_Specification, 06_UIUX_Design_Specification |
| **Date** | 2026-07-03 |

> This plan turns the six requirement documents into an executable, phased build sequence. It does **not** re-specify the product — every requirement referenced here (`FR-*`, `NFR-*`) is defined in the SRS, every collection in the DDD, every endpoint in the API spec, and every screen in the UI/UX spec. This document specifies **order, grouping, dependencies, acceptance criteria, and effort** for building it.

---

## 0. Decisions Locked for This Plan

These four decisions were confirmed by the stakeholder and shape everything below. If any changes, the affected phases change with it.

| # | Decision | Chosen | Impact on plan |
|---|---|---|---|
| D1 | **First-deliverable scope** | Core learning loop first | Phases 1–9 (below) constitute the first shippable release ("v1.0 core"). Live classroom, gamification, forums/messaging, events, alumni, i18n are grouped into later phases (10–15), matching PRD §8 release plan (v1.1 / v1.2). |
| D2 | **Live classroom strategy** | Zoom/MS Teams first; native WebRTC deferred behind a feature flag | The `deliveryMode` field and Zoom/Teams integration (FR-LIVE-01, 03, 09, 10-provider) are built in Phase 10. Native mediasoup SFU (FR-LIVE-02, 04–08, 10-native) is Phase 15, gated by `institutions.featureFlags.nativeLiveClassroom`. This directly follows PRD §9 risk mitigation. |
| D3 | **Team** | Solo developer | Work is sequenced strictly serially. Estimates are solo-developer weeks (see §7 caveat). No parallel-squad structure. |
| D4 | **Infrastructure** | Local-first, wire cloud later | Phase 0 stands up a fully dockerized local stack (local MongoDB, MinIO, Mailpit, local Redis). Real cloud provisioning (Atlas, S3+CloudFront, Vercel, Twilio, email provider, Sentry) is a discrete task inside Phase 9 before staging/prod deploy. |

---

## 1. Assumptions & Explicit Deferrals

### 1.1 Defaults adopted directly from the docs (no further decision needed)
These were specified with defaults in the requirement documents. This plan adopts them as-is and flags them so nothing is silently assumed:

- **Enrollment modes:** Both `open` and `approval_required` are built in Phase 3 (FR-ENROLL-01, 02), configured per course via `courses.enrollmentMode`. (Answers PRD §10 open question #1 by supporting both.)
- **Compliance depth at v1.0:** GDPR/FERPA-*style* principles per NFR-PRIV-01/02/03 — TLS, encryption at rest via managed providers, RBAC-restricted access to student records, immutable audit log, and data export/erasure hooks. Formal certification/contractual compliance is treated as hardening, not a v1.0 blocker (per PRD §10 open question #3). **See Open Item O-3 if a specific regime is contractually required at launch.**
- **Launch languages:** i18n framework wired so strings are externalized (FR-I18N-02) from Phase 1 onward; the actual language *switcher* and a second language (FR-I18N-01) are Phase 14. Launch language = English.
- **Auth mechanism:** NextAuth.js + JWT access/refresh pattern per SAD §8. Google OAuth (FR-AUTH-07) included in Phase 1 as it is cheap once NextAuth is in place.
- **Course versioning:** Assessment-revision strategy from DDD §5 (edits to an assessment with submissions create a new closed revision) — implemented in Phase 5, not full course-tree versioning.

### 1.2 Out of scope for the entire plan (per PRD §5.2)
Native mobile apps, payments/billing, plagiarism detection, AI auto-grading of subjective answers, advanced proctoring, full white-labeling/per-tenant theming, offline playback, content marketplace. These are **not** in any phase below.

### 1.3 Multi-tenancy stance
Every collection carries `institutionId` from day one (DDD §1.1), and all queries filter by it — but the **Super Admin tenant-management UI and full self-serve onboarding are minimal in v1.0**. For a solo build with 5–10 first customers (PRD §3.1), institutions are created via a seed script / minimal admin tool. Full tenant self-service is a growth-phase concern. The *data model* is multi-tenant ready; the *tooling* is deliberately thin at first.

---

## 2. Technology Stack (from SAD §9 — locked)

| Layer | Technology |
|---|---|
| Framework | Next.js 14+ (App Router, Route Handlers), React, **TypeScript** (NFR-MAINT-01) |
| Styling / UI | Tailwind CSS + shadcn/ui |
| Client state/data | TanStack Query (server cache), Zustand (local UI state) |
| Auth | NextAuth.js, JWT (short-lived access + rotated httpOnly refresh) |
| Database | MongoDB + Mongoose ODM |
| Validation | Zod (shared client/server schemas at route boundary) |
| Cache / Queue / Pub-Sub | Redis + BullMQ |
| Real-time (non-media) | Socket.io (Phase 12+) |
| Object storage | S3-compatible (MinIO locally → AWS S3 in cloud) |
| CDN | CloudFront (cloud phase only) |
| Email / SMS | Resend or SendGrid / Twilio (Mailpit locally) |
| Certificates/PDF | PDF render in worker (e.g. `@react-pdf/renderer` or Puppeteer) |
| Live (deferred) | Zoom API + Microsoft Graph API (Phase 10); mediasoup SFU (Phase 15) |
| Testing | Vitest (unit), Playwright (E2E) — target ≥70% on critical logic (NFR-MAINT-02) |
| Monitoring | Sentry, Vercel Analytics (cloud phase) |
| CI/CD | GitHub Actions → Vercel (app); container registry → container platform (worker/media) |

---

## 3. Repository & Project Structure (proposed)

A single Next.js repo (modular monolith per SAD §2) plus two sibling service packages that share types. Proposed as a starting point — **see Open Item O-1** if a monorepo tool (Turborepo/pnpm workspaces) is preferred.

```
learnsphere/
├─ apps/
│  └─ web/                     # Next.js app (frontend + /api/v1 Route Handlers)
│     ├─ app/
│     │  ├─ (public)/          # catalog, login, register, certificate verify
│     │  ├─ (student)/         # dashboard, my-courses, player, grades, etc.
│     │  ├─ (instructor)/      # dashboard, builder, grading queue, roster
│     │  ├─ (admin)/           # approval queue, users, audit log, settings
│     │  └─ api/v1/            # Route Handlers, grouped by domain module
│     ├─ components/           # shadcn/ui-based, incl. ProgressRing, StatusChip
│     └─ lib/                  # client utils, TanStack Query hooks
├─ packages/
│  ├─ domain/                  # shared: Mongoose models, Zod schemas, TS types,
│  │                           #  business logic (grading, enrollment FSM, RBAC)
│  └─ config/                  # env parsing, shared constants, feature flags
├─ services/
│  ├─ worker/                  # BullMQ worker (Phase 7): notifications, certs, reports
│  └─ media/                   # mediasoup SFU (Phase 15 only — stub until then)
├─ docker-compose.yml          # local: mongo, redis, minio, mailpit
└─ .github/workflows/          # CI
```

**Key principle:** all data models, Zod validators, and pure business logic live in `packages/domain` so the Next.js API, the worker, and tests share one source of truth (supports NFR-MAINT-03 API/contract consistency).

---

## 4. Cross-Cutting Foundations (built once, used everywhere)

These are established early (Phase 0–1) and are non-negotiable dependencies for every later feature:

| Concern | Where established | Requirement |
|---|---|---|
| **Env + config parsing** | Phase 0, `packages/config` | Fail-fast on missing env |
| **Mongoose connection + `$jsonSchema` validators** | Phase 1 | DDD §1.2 (Mongoose + DB-level backstop on `users`, `enrollments`, `submissions`, `audit_logs`) |
| **RBAC middleware** | Phase 1 | FR-AUTH-04, NFR-SEC-03 — enforced server-side on **every** route, role + resource-ownership based |
| **Zod request validation at route boundary** | Phase 1 | SAD §8, NFR-SEC-04 |
| **Audit-log service hook** | Phase 1, applied per phase | FR-ADMIN-02, NFR-PRIV-03 — append-only, shared service hook (not per-handler) |
| **Institution scoping helper** | Phase 1 | DDD §1.1 — every query filtered by `institutionId` |
| **Rate limiting** | Phase 1 (auth) → all writes by Phase 9 | NFR-SEC-07, FR-AUTH-08 |
| **Notification dispatch interface** | Phase 7 | FR-NOTIFY-* — features call `notify()`; delivery is async via worker |
| **Design system primitives** (ProgressRing, StatusChip, BadgeChip, DataTable, Button, Toast) | Phase 0–1 | UI/UX §2.5 — accessible from first implementation (NFR-USE-01) |

---

## 5. Phased Delivery Plan

Each phase lists: **Goal · Requirements covered · Key tasks · Acceptance criteria · Solo effort estimate · Depends on**. Phases 0–9 = **v1.0 core release** (D1). Phases 10–15 = post-core (v1.1 / v1.2 / growth).

---

### Phase 0 — Project Foundation & Local Dev Environment
**Goal:** A running Next.js + TypeScript skeleton with the full local infra stack and design-system primitives, so every later phase has a place to land.

**Key tasks:**
- Scaffold Next.js (App Router, TS), Tailwind, shadcn/ui; configure lint/format/CI (GitHub Actions running typecheck + tests).
- `docker-compose.yml`: MongoDB, Redis, MinIO (S3), Mailpit (email). One-command local bring-up.
- `packages/config` env parsing (fail-fast); `.env.example` documenting every variable.
- Base layout shell, routing groups (public/student/instructor/admin/alumni), theme tokens from UI/UX §2.2–2.4.
- Build signature components: **Progress Ring** (segmented, 3 sizes), **Status Chip**, **Badge Chip**, **Button** (with `focus-ring`), **Data Table**, **Toast** — all keyboard-accessible with `prefers-reduced-motion` respected (UI/UX §2.5, §2.6, §6).

**Acceptance:** `docker compose up` + `dev` gives a themed shell; CI green; a Storybook-style demo page renders all primitives passing basic axe checks.

**Effort:** ~1–1.5 weeks. **Depends on:** —

---

### Phase 1 — Identity: Auth, RBAC, Users, Institutions
**Goal:** Every subsequent endpoint can authenticate a user, know their role + institution, and be authorized. This is the spine of the whole system.

**Requirements:** FR-AUTH-01…09, FR-ADMIN-01, FR-ADMIN-04 (tenant config basics), FR-I18N-02 (string externalization), NFR-SEC-01…03, 07.

**Key tasks:**
- `institutions` + `users` Mongoose models + `$jsonSchema` validators + indexes (DDD §3.1, §3.2).
- NextAuth.js: credentials + Google OAuth; JWT access (~15 min) + rotated httpOnly refresh cookie (SAD §8).
- Registration with email verification (FR-AUTH-01); password reset via time-limited single-use link (FR-AUTH-05); account lockout after 5 fails / 15 min (FR-AUTH-08).
- **RBAC middleware** (role + resource-ownership) applied to a route wrapper used by all future handlers (FR-AUTH-04).
- **Audit-log service** + hook on auth events and role changes (FR-AUTH-09, FR-ADMIN-02).
- Rate limiting on auth endpoints (NFR-SEC-07).
- Minimal Super Admin institution config + seed script to create the first institution/admin (FR-ADMIN-04).
- API: `/auth/*`, `/users/me`, `/users/{id}`, `/admin/users*` (create/deactivate/role — FR-ADMIN-01), `/admin/audit-logs`.
- UI: login, register, verify-email, reset-password, profile & settings (incl. notification preferences shell), basic admin user list.
- i18n provider wired; all new strings externalized.

**Acceptance:** A user can register → verify → log in → refresh → reset password; a locked account behaves correctly; every `/api/v1` route rejects unauthorized/cross-tenant access with 403; role change and login events appear in `audit_logs`.

**Effort:** ~2–3 weeks. **Depends on:** Phase 0.

---

### Phase 2 — Course Authoring & Management + Admin Approval
**Goal:** Instructors build courses; admins approve them. Produces the central `courses` document consumed by nearly every later phase.

**Requirements:** FR-COURSE-01…10, FR-ADMIN-02 (publish audit), UC-03. Drag-and-drop with keyboard equivalent (FR-COURSE-03, UI/UX §6).

**Key tasks:**
- `courses` model with embedded modules → lessons → contentItems, `status` state machine (`draft → pending_review → published/rejected → archived`), `completionCriteria`, `releaseRule`, templates (`isTemplate`, `clonedFromCourseId`) (DDD §3.3).
- Course CRUD + `submit-for-review`, `clone-as-template`, `archive` endpoints.
- Admin approval queue: `/admin/courses/pending-review`, `approve`, `reject` (required comment) — writes `course.publish` audit entry (FR-COURSE-07/08, UC-03).
- Drip release rules (immediate / fixed_date / offset_from_enrollment) — stored now, enforced at content-access time in Phase 4 (FR-COURSE-06).
- Assessment-revision versioning groundwork (DDD §5) — the rule that a live assessment edit closes+clones; wired fully in Phase 5.
- UI: Course Builder with drag-and-drop **and** keyboard reorder + ARIA live announcements (UI/UX §5.3, §6); Templates library; Admin approval queue + read-only structure preview (UI/UX §5.5).

**Acceptance:** Instructor builds a multi-module course, saves as template, clones it; submits for review; admin rejects with comment (→ draft, instructor notified stub) then approves (→ published, appears in catalog); reorder works via mouse **and** keyboard; publish/reject logged to audit.

**Effort:** ~3–4 weeks. **Depends on:** Phase 1.

---

### Phase 3 — Enrollment
**Goal:** Students get into courses; the enrollment state machine that gates content/assessment/certification exists.

**Requirements:** FR-ENROLL-01…06, FR-ADMIN-02 (enrollment change audit).

**Key tasks:**
- `enrollments` model + unique `{studentId, courseId}` index + status FSM (`pending_approval → active → completed/dropped/rejected`) (DDD §3.4).
- Self-enroll (open) and approval-required flows; approve/reject/drop endpoints (drop requires logged reason — audit) (FR-ENROLL-01, 02, 04, 05).
- Bulk enroll via CSV + multi-select (FR-ENROLL-03).
- Enrollment capacity enforcement when configured (FR-ENROLL-06).
- Public course catalog (SSR/Server Components per SAD §4.1) + course detail + enroll action; "My Enrollments" view.
- Enrollment state transitions covered by unit tests (NFR-MAINT-02 lists this as critical logic).

**Acceptance:** Student self-enrolls in an open course (→ active) and requests an approval-required course (→ pending → approved); instructor bulk-enrolls via CSV; capacity limit blocks over-enrollment; drop logs a reason to audit.

**Effort:** ~2 weeks. **Depends on:** Phases 1, 2.

---

### Phase 4 — Content Delivery
**Goal:** Students consume lesson content 24/7 with progress tracking; drip rules enforced.

**Requirements:** FR-CONTENT-01…05, FR-COURSE-06 (drip enforcement), NFR-SEC-05 (upload validation), NFR-PERF-02 (playback start).

**Key tasks:**
- Signed upload URL flow: `/content/upload-url` → client uploads to MinIO/S3; type/size validation at boundary (default 2 GB video / 100 MB other) (FR-CONTENT-02, NFR-SEC-05).
- Video transcoding kickoff enqueued to worker (adaptive bitrate / HLS manifest) — **worker introduced here or Phase 7**; for local-first, a stub/ffmpeg job produces a single rendition initially, ABR hardened before cloud (FR-CONTENT-01).
- `lesson_progress` model (high-write, minimal indexes per DDD §3.5); `PUT /courses/{id}/lessons/{id}/progress` computes `percentConsumed`/`status` (FR-CONTENT-03).
- Drip-release enforcement at access time: locked lessons show release date (FR-COURSE-06, UI/UX §5.2 🔒 behavior).
- Course Player UI: lesson sidebar with completion/lock icons, video/doc/audio/article players, resources, Mark Complete, live-updating header Progress Ring (UI/UX §5.2).

**Acceptance:** Instructor uploads a video (rejected if over limit / wrong type); student plays it, progress persists and drives the ring; a drip-locked lesson is inaccessible until its release date; recordings/content reachable for enrollment duration.

**Effort:** ~2.5–3.5 weeks (transcoding is the swing factor). **Depends on:** Phases 2, 3; benefits from Phase 7 worker.

---

### Phase 5 — Assessment & Grading
**Goal:** The graded core of the LMS — assignments, quizzes, auto + manual grading, rubrics, weighting.

**Requirements:** FR-ASSESS-01…10, UC-01, DDD §5 versioning, NFR-MAINT-02 (grading is named critical logic).

**Key tasks:**
- `assessments` model (assignment | quiz discriminator; embedded questions/rubric) + `submissions` model (DDD §3.6, §3.7).
- Assignment creation (instructions, due date, max score, submission types); quiz builder (multiple_choice, true_false, matching, essay) (FR-ASSESS-01, 02).
- Submission flow (file and/or text), late-flagging + configurable late penalty (FR-ASSESS-09, UC-01).
- **Auto-grading** of objective questions on submit; route essay/file to manual grading queue (FR-ASSESS-03, 04).
- **Rubric-based** and **weighted** grading; per-criterion rollup; final course grade computation (FR-ASSESS-05, 06). *Fully unit-tested — this is the highest-correctness-risk logic.*
- Bulk grading (grade/comment template to many submissions) (FR-ASSESS-07).
- Grade-posted notification (via Phase 7 notify interface); student grade history + standing (FR-ASSESS-08, 10).
- Assessment-revision versioning enforced (edit-with-submissions → close + clone) (DDD §5).
- Grade changes write before/after audit entries (FR-ADMIN-02).
- UI: assignment/quiz taker, instructor grading queue (Data Table, bulk-select), rubric grader, student grades view.

**Acceptance:** Objective quiz auto-grades correctly; essay lands in manual queue; rubric scores roll up to weighted final grade matching hand-calculation; late submission flagged + penalized; editing a submitted assessment preserves prior grades; grade edit audited; student sees feedback + standing.

**Effort:** ~3.5–4.5 weeks. **Depends on:** Phases 2, 3; needs Phase 7 for grade notifications.

---

### Phase 6 — Dashboards (Student, Instructor, Admin)
**Goal:** The "where do I stand?" surfaces (UI/UX §1 core retention lever) that aggregate everything built so far.

**Requirements:** FR-DASH-01, 04, 05, 06 (export), NFR-PERF-04 (LCP ≤2.5s), NFR-USE-03 (3-click core tasks).

**Key tasks:**
- Student dashboard: upcoming deadlines (soonest-first, overdue pinned), recent grades, alerts, per-course Progress Rings (FR-DASH-01, UI/UX §5.1 behavior).
- Instructor dashboard: enrollment, average grades, attendance trends (attendance lands in Phase 10), pending grading count (FR-DASH-04).
- Admin dashboard: platform usage, pending approvals, compliance metrics (FR-DASH-05).
- Redis-cached aggregates with short TTL (SAD §7) for dashboard performance.
- Report export CSV/PDF (FR-DASH-06) — PDF via worker.
- `/reports/*` endpoints.

**Acceptance:** Student dashboard reflects real deadlines/grades/progress and meets LCP target on a mid-tier mobile profile; core tasks reachable in ≤3 clicks; instructor/admin dashboards show accurate counts; CSV export works.

**Effort:** ~2–3 weeks. **Depends on:** Phases 3, 4, 5 (needs data to aggregate).

---

### Phase 7 — Notifications + Background Worker & Queue
**Goal:** Stand up the async backbone (BullMQ worker) and multichannel notifications used by grading, deadlines, announcements. *May be pulled earlier if Phase 4/5 need it — see dependency notes.*

**Requirements:** FR-NOTIFY-01…05, SAD §4.5, NFR-SCALE (queue keeps API responsive), FR-COLLAB-05 groundwork.

**Key tasks:**
- `services/worker` with BullMQ on Redis; job types: notification dispatch, (transcoding kickoff), certificate gen, report gen.
- `notifications` model + in-app feed; `notify()` service interface consumed by earlier phases.
- Channels: in-app (always), email (Mailpit local → Resend/SendGrid cloud), SMS (Twilio) — per-user preference per type (FR-NOTIFY-01).
- Scheduled reminders: assignment deadlines (default 24h) and — once Phase 10 exists — live sessions (FR-NOTIFY-02, 03). Deadline reminders use repeatable/scheduled jobs.
- Grade posted / enrollment status / announcement notifications (FR-NOTIFY-04); instructor/admin course-wide announcement broadcast (FR-NOTIFY-05).
- Notification center UI + preferences.

**Acceptance:** Grading a submission and posting an announcement deliver in-app + email (per prefs); deadline reminder fires at configured lead time; a broadcast to a cohort does not block the API request path (goes through queue).

**Effort:** ~2–2.5 weeks. **Depends on:** Phase 1; **note:** because Phases 4–6 reference `notify()` and the worker, do a **thin slice of Phase 7 (worker + in-app notify) before/alongside Phase 5**, then complete email/SMS/scheduling here.

---

### Phase 8 — Certificates
**Goal:** Automatic certificate issuance on course completion; public verification.

**Requirements:** FR-CERT-01, 02, UC-04.

**Key tasks:**
- Completion detection: when final grade posted and `completionCriteria` (min grade + min attendance) met → mark enrollment `completed`, enqueue certificate job (UC-04).
- Worker renders PDF with unique `verificationCode`, stores in S3/MinIO (FR-CERT-01).
- Public verification page + `/certificates/verify/{code}` (FR-CERT-02).
- Student "Certificates" view; groundwork for alumnus role transition (FR-AUTH-06, completed in Phase 14).
- *Note:* attendance component of completion criteria is only meaningful once Phase 10 provides attendance; until then completion uses grade criteria (documented behavior).

**Acceptance:** Meeting completion criteria issues a downloadable PDF; the verification URL resolves a valid code and rejects an invalid one.

**Effort:** ~1–1.5 weeks. **Depends on:** Phases 5, 7.

---

### Phase 9 — v1.0 Hardening, Cloud Provisioning & Deploy
**Goal:** Take the core release from "works locally" to "production-ready, secure, observable, deployed."

**Requirements:** NFR-SEC-01…07, NFR-PRIV-01…03, NFR-AVAIL-01…03, NFR-USE-01…03, NFR-MAINT-02, 03, PRD uptime/backup targets.

**Key tasks:**
- **Cloud provisioning (D4):** MongoDB Atlas (replica set), S3 + CloudFront, Vercel (app), container platform for worker, Upstash/managed Redis, email + SMS provider accounts, Sentry. Env-per-stage (dev/staging/prod) with isolated credentials (SAD §6).
- CI/CD: GitHub Actions → Vercel (app), registry → container platform (worker).
- Security pass: OWASP Top-10 review, rate limiting on all writes, upload validation + optional malware-scan hook, TLS enforcement, secrets in platform secret manager (NFR-SEC-*, SAD §8).
- Privacy: data export + erasure endpoints/flow, audit-log immutability + access restriction verified (NFR-PRIV-*).
- Backups: automated daily Atlas backup, 30-day retention, tested restore (NFR-AVAIL-03).
- Accessibility audit against WCAG 2.1 AA across core flows (NFR-USE-01); responsive check 360px→desktop + 200% zoom (NFR-USE-02); PWA installability (PRD §5.1).
- Test coverage ≥70% on grading, enrollment FSM, RBAC (NFR-MAINT-02); Playwright E2E for the core learner + instructor + admin flows; OpenAPI kept in sync (NFR-MAINT-03).
- Observability: Sentry wired across app + worker; uptime/error dashboards.

**Acceptance:** App deployed to staging then prod; CI enforces typecheck + tests; a11y audit passes on core flows; restore drill succeeds; coverage gate met; **v1.0 core release is live.**

**Effort:** ~2.5–3.5 weeks. **Depends on:** Phases 1–8.

---
---

## 6. Post-Core Phases (v1.1 / v1.2 / Growth)

Built after the v1.0 core release ships and is validated with real users. Ordered by PRD §8 release plan.

### Phase 10 — Live Sessions (Zoom/MS Teams first) — *v1.1*
**Requirements:** FR-LIVE-01, 03, 09, 10 (provider path), 11; FR-NOTIFY-03 (session reminders); attendance from provider reports.
- `live_sessions` + `attendance` models (DDD §3.8, §3.9).
- Schedule session with `deliveryMode = zoom | ms_teams`; create meeting via Zoom API / MS Graph; surface one-click join link (FR-LIVE-01, 03).
- Ingest provider recording + attendance via webhook (worker) → attach to session; derive attendance (FR-LIVE-09, 10); manual attendance override with logged reason (FR-LIVE-11).
- Session reminders (15 min + 1 day) via Phase 7 scheduler.
- Instructor scheduler UI + student "Live Sessions" + join card (UI/UX §5.1 live card, §4.3 Zoom/Teams branch).
- Instructor/admin dashboards gain real attendance trends; completion criteria gains real attendance input.
- **Effort:** ~3–4 weeks. **Depends on:** Phases 3, 6, 7.

### Phase 11 — Gamification — *v1.1*
**Requirements:** FR-DASH-02, 03; badges/points/leaderboard.
- `badges` + `user_badges` models (DDD §3.13); points on `users.gamification`.
- Award rules (course completion, on-time streaks, forum participation once Phase 12 exists); leaderboard per course with opt-out; badge-awarded notifications.
- Badges & Leaderboard UI; Badge Chip usage (UI/UX §2.5).
- **Effort:** ~2 weeks. **Depends on:** Phases 5, 7, 8.

### Phase 12 — Collaboration: Forums, Messaging, Realtime Gateway — *v1.1*
**Requirements:** FR-COLLAB-01…05; Socket.io realtime; FR-NOTIFY (forum/message notifications).
- `forum_threads`, `forum_posts`, `conversations`, `messages` models (DDD §3.10, §3.11).
- Course forum with threads/replies + Q&A accepted-answer (FR-COLLAB-01, 02); 1:1 messaging + group channels (FR-COLLAB-03, 04).
- **Socket.io Realtime Gateway** (SAD §4.4) with Redis adapter: live forum/message updates, typing, in-app notification push (FR-COLLAB-05).
- **Effort:** ~3 weeks. **Depends on:** Phases 3, 7.

### Phase 13 — Events & Webinars — *v1.2*
**Requirements:** FR-EVENT-01, 02.
- `events` + `event_registrations` models (DDD §3.15); create event with registration/capacity/reminders; browse + register.
- **Effort:** ~1.5 weeks. **Depends on:** Phases 1, 7.

### Phase 14 — Alumni Portal & i18n Language Switching — *v1.2*
**Requirements:** FR-ALUMNI-01, 02; FR-AUTH-06 (auto role transition); FR-I18N-01.
- Auto Student→Alumnus transition on completing all programs, preserving history (FR-AUTH-06, UC-04).
- Alumni dashboard, persistent certificates/transcript, opt-in directory (FR-ALUMNI-01, 02).
- Language switcher + second launch language (FR-I18N-01) — framework already externalized from Phase 1.
- **Effort:** ~2 weeks. **Depends on:** Phases 1, 8.

### Phase 15 — Native WebRTC Live Classroom (mediasoup SFU) — *Growth, feature-flagged (D2)*
**Requirements:** FR-LIVE-02, 04, 05, 06, 07, 08, 10 (native path); NFR-PERF-03 (100+ concurrent), NFR-AVAIL-02 (graceful degrade).
- `services/media`: mediasoup SFU, room lifecycle, join-token flow (SAD §5.2), in-session chat/polls/whiteboard relay, breakout rooms.
- Recording pipeline → S3 → worker stitch/transcode; native attendance from join/leave (FR-LIVE-08, 10).
- Native classroom UI (UI/UX §5.4 host/participant, mobile speaker view §8); live captions where Web Speech API available (§6).
- Deploy media service to container platform; scale per active-room load (SAD §7).
- Gated by `institutions.featureFlags.nativeLiveClassroom`; tested with small cohorts first (PRD §9).
- **Effort:** ~5–7 weeks (highest risk). **Depends on:** Phase 10.

---

## 7. Effort Summary & Sequencing Notes

| Phase | Release | Solo estimate |
|---|---|---|
| 0 Foundation | v1.0 | 1–1.5 wk |
| 1 Identity | v1.0 | 2–3 wk |
| 2 Course authoring | v1.0 | 3–4 wk |
| 3 Enrollment | v1.0 | 2 wk |
| 4 Content delivery | v1.0 | 2.5–3.5 wk |
| 5 Assessment & grading | v1.0 | 3.5–4.5 wk |
| 6 Dashboards | v1.0 | 2–3 wk |
| 7 Notifications + worker | v1.0 | 2–2.5 wk |
| 8 Certificates | v1.0 | 1–1.5 wk |
| 9 Hardening + deploy | v1.0 | 2.5–3.5 wk |
| **v1.0 core subtotal** | | **~22–29 weeks (~5–7 months)** |
| 10 Live (Zoom/Teams) | v1.1 | 3–4 wk |
| 11 Gamification | v1.1 | 2 wk |
| 12 Collaboration | v1.1 | 3 wk |
| 13 Events | v1.2 | 1.5 wk |
| 14 Alumni + i18n | v1.2 | 2 wk |
| 15 Native WebRTC | Growth | 5–7 wk |

> **Estimate caveat:** These are honest solo-developer estimates for a system of this scope, assuming an experienced full-stack Next.js/Mongo developer working focused time, and **excluding** learning-curve time on unfamiliar pieces (mediasoup, MediaConvert, Zoom/Graph APIs). The full spec is genuinely a multi-engineer, multi-quarter product; a solo build should expect the v1.0 core alone to take ~5–7 months. If the timeline is fixed and shorter, we should cut scope from the v1.0 core (candidates: bulk grading FR-ASSESS-07, weighted-rubric library, CSV bulk enroll, report PDF export) rather than compress quality. **See Open Item O-2.**

**Practical sequencing note:** Phase 7's worker + in-app `notify()` should be partially built *before* Phase 5 (grading needs notifications) and Phase 4 (transcoding needs the worker). The table lists Phase 7 discretely for clarity, but in execution its thin slice moves up.

---

## 8. Testing & Quality Strategy (spans all phases)

- **Unit (Vitest):** grading calculations, enrollment/course state machines, RBAC checks, drip-release logic — the NFR-MAINT-02 "critical business logic" set, ≥70% coverage.
- **Integration:** API route handlers against a test MongoDB (in-memory or dockerized), asserting RBAC + tenant isolation on every endpoint.
- **E2E (Playwright):** the core flows from UI/UX §4 — registration→enroll→consume→submit→graded→certificate; instructor build→submit→approved; admin approval.
- **Accessibility:** automated axe checks in CI on key pages + manual keyboard/screen-reader pass in Phase 9 (NFR-USE-01).
- **Contract:** OpenAPI spec is the source of truth; validate handlers against it (NFR-MAINT-03).

---

## 9. Risk Register (build-specific, complements PRD §9)

| Risk | Phase | Mitigation |
|---|---|---|
| Grading logic errors corrupt academic records | 5 | Heavy unit tests, assessment-revision versioning, audit trail; hand-verify rollups before ship |
| Video transcoding/ABR complexity underestimated | 4 | Ship single-rendition playback locally first; harden ABR (MediaConvert/ffmpeg) before cloud; CDN offloads origin |
| Solo-dev scope vs. timeline mismatch | all | Phased releases; v1.0 core is independently shippable; explicit cut-list in §7 |
| Native WebRTC (mediasoup) is a large unknown | 15 | Fully deferred behind a feature flag; Zoom/Teams is the reliable path first (D2) |
| Local↔cloud environment drift | 9 | MinIO/Mailpit mirror S3/email interfaces; env parity enforced via `packages/config`; provision cloud before staging |
| Multi-tenant data leakage | 1+ | `institutionId` on every model + every query filtered; RBAC includes resource-ownership; integration tests assert isolation |

---

## 10. Open Items Still Needing Your Decision

None of these block starting Phase 0, but they should be resolved before the phase that depends on them. I have **not** assumed answers to these:

| ID | Question | Needed by | Current default if unanswered |
|---|---|---|---|
| **O-1** | Repo tooling: single Next.js repo with local packages (as in §3), or a formal monorepo (Turborepo / pnpm workspaces)? | Phase 0 | Single repo with `packages/*` via workspaces |
go with formal mono repo, use the industry best standards for directory structure. 
| **O-2** | Is there a fixed target date for v1.0? If yes and it's shorter than ~5–7 months, which §7 cut-list items are acceptable to drop? | Before Phase 1 | No fixed date; full v1.0 core scope |
go with full scopr
| **O-3** | Is any specific compliance regime (FERPA, GDPR, a local data-protection law) **contractually required at v1.0 launch**, or is principle-based hardening sufficient for now? (PRD §10 Q3) | Phase 9 | Principle-based hardening only |
no
| **O-4** | Email + SMS providers: confirm Resend vs SendGrid, and confirm Twilio for SMS (affects Phase 7 integration + accounts). | Phase 7 cloud wiring | Resend (email) + Twilio (SMS) |
first go with only email sending. skip the twilio integration
| **O-5** | For Zoom/Teams (Phase 10): will first customers use their own Zoom/Teams accounts (per PRD assumption), and do we have API/dev access to build against? (PRD §10 Q2) | Before Phase 10 | Assume customer-provided accounts; build against sandbox |
we use the api
| **O-6** | Certificate design: is there a required visual template/branding for the PDF, or is a clean default acceptable for v1.0? | Phase 8 | Clean default using design-system tokens |
not now. 
| **O-7** | Product name: keep "LearnSphere" placeholder or rename before build? (PRD naming note) | Phase 0 (naming) | Keep "LearnSphere" |
"Lumora" update the name with this given name. 

---

## 11. Recommended Immediate Next Steps (once this plan is approved)

1. Resolve Open Items **O-1, O-2, O-7** (they affect Phase 0 setup).
2. Execute **Phase 0** (foundation + local stack + design-system primitives).
3. Execute **Phase 1** (identity spine) — the highest-leverage foundation.
4. Review at the end of Phase 1 to validate estimates against actual solo velocity, then confirm the rest of the v1.0 core cadence.

---
*End of Implementation Plan. Awaiting review and approval before implementation begins.*

