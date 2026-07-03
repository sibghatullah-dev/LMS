# Lumora — Learning Management System

Full-stack LMS built as a Turborepo monorepo (Next.js + MongoDB), per the requirement
documents in [`requireents_documents/`](./requireents_documents) and the phased build in
[`07_Implementation_Plan.md`](./requireents_documents/07_Implementation_Plan.md).

> **Status:** Phase 0 complete — project foundation, design system, and local infrastructure.
> Feature work (auth, courses, enrollment, content, assessment, dashboards, notifications,
> certificates) proceeds through Phases 1–9. See the implementation plan.

## Workspace layout

```
apps/web            Next.js app (frontend + /api/v1 Route Handlers)
packages/config     Typed env parsing, feature flags, shared constants
packages/domain     Shared Mongoose models, Zod schemas, business logic, RBAC, errors
services/worker     BullMQ background worker (notifications, certs, transcode, reports)
services/media      WebRTC SFU (mediasoup) — placeholder until Phase 15
```

## Prerequisites

- **Node.js** ≥ 20.9
- **pnpm** 9 (`corepack enable` activates the version pinned in `package.json`)
- **Docker Desktop** — for the local infrastructure stack

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# then set NEXTAUTH_SECRET:  openssl rand -base64 32

# 3. Start local infrastructure (MongoDB, Redis, MinIO, Mailpit)
pnpm infra:up

# 4. Run the app
pnpm dev
```

| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| Design system demo | http://localhost:3000/design-system |
| API health check | http://localhost:3000/api/v1/health |
| MinIO console (S3) | http://localhost:9001 (lumora / lumora-secret) |
| Mailpit inbox | http://localhost:8025 |

## Scripts (run from the repo root)

```bash
pnpm dev         # run all apps/services in dev (turbo)
pnpm build       # production build (turbo)
pnpm typecheck   # tsc --noEmit across all packages (turbo)
pnpm lint        # ESLint across the whole monorepo (single root flat config)
pnpm test        # Vitest across all packages (turbo)
pnpm infra:up    # docker compose up -d
pnpm infra:down  # docker compose down
```

## Conventions

- **TypeScript everywhere** (NFR-MAINT-01); shared types/logic live in `packages/*` so the
  web app, worker, and tests share one source of truth.
- **Design system** tokens (colors, type, spacing) are encoded in `apps/web/tailwind.config.ts`
  from UI/UX Design Spec §2; primitives live in `apps/web/src/components/ui`.
- **Env is fail-fast**: `packages/config` validates `process.env` against a Zod schema at boot.
