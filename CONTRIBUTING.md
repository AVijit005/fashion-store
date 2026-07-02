# Contributing

Thanks for your interest in improving Aura Streetwear. This document explains how to set up the project locally, submit changes, and get them merged.

## Quick start

```bash
# Prerequisites: Node 20+, Bun, Docker

# 1. Clone the repo
git clone https://github.com/<your-org>/aura-streetwear.git
cd aura-streetwear

# 2. Install frontend deps (Bun)
bun install

# 3. Install backend deps (npm)
cd backend && npm install && cd ..

# 4. Copy env templates and edit
cp backend/.env.example backend/.env
cp .env.example .env
# edit both files with your local values (see "Local dev setup" below)

# 5. Start the stack via Docker
docker compose -f docker-compose.yml up -d

# 6. Apply database migrations
cd backend && npm run db:migrate && cd ..

# 7. Start the dev servers
# Frontend (in one terminal, from repo root)
bun run dev

# Backend (in another terminal)
cd backend && npm run start:dev
```

You should now have:
- Storefront at `http://localhost:5173`
- Backend API at `http://localhost:3000`
- Swagger docs at `http://localhost:3000/docs`
- MinIO console at `http://localhost:9001`
- Postgres at `localhost:5432`
- Redis at `localhost:6379`

## Local dev setup

### Backend

The backend is a NestJS app. It needs:

- **Postgres 15+** — provisioned via `docker compose up postgres`
- **Redis 7+** — provisioned via `docker compose up redis`
- **S3 or MinIO** — use MinIO locally (`docker compose up minio`)
- **Razorpay test keys** — get them from https://dashboard.razorpay.com/app/keys (toggle to "Test mode" first)
- **SMTP server** — use Mailhog or Mailtrap. The easiest local option is to use a fake SMTP like [smtp4dev](https://github.com/rnwood/smtp4dev).

Edit `backend/.env`:

```bash
DATABASE_URL="postgresql://aura_user:aura_password@localhost:5432/aura_db?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="dev-only-secret-change-me-in-production-please"
JWT_EXPIRES_IN="15m"
REFRESH_TOKEN_EXPIRES_IN_DAYS="7"
RAZORPAY_KEY_ID="rzp_test_your_key_id"
RAZORPAY_KEY_SECRET="your_test_key_secret"
RAZORPAY_WEBHOOK_SECRET="your_test_webhook_secret"
AWS_ACCESS_KEY_ID="aura_admin"
AWS_SECRET_ACCESS_KEY="aura_password"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="aura-studio"
AWS_S3_ENDPOINT="http://localhost:9000"
SENTRY_DSN=""  # leave blank to disable Sentry locally
EMAIL_FROM="Aura <no-reply@aurastreetwear.local>"
SMTP_HOST="localhost"
SMTP_PORT="1025"  # Mailhog default
SMTP_USER=""
SMTP_PASS=""
FRONTEND_URL="http://localhost:5173"
```

### Frontend

Create `.env`:

```bash
VITE_API_URL=http://localhost:3000
VITE_SITE_URL=http://localhost:5173
VITE_RAZORPAY_KEY_ID=rzp_test_your_key_id
VITE_SENTRY_DSN=  # leave blank to disable
```

The TanStack Start build will inline these at build time.

### Seeding sample data

```bash
cd backend && npm run db:seed
```

This creates a few categories, products, and a test admin user (`admin@inkstudio.local` / `admin123`). The seed script is idempotent — running it twice is safe.

## Project layout

```
.
├── backend/                      # NestJS API
│   ├── prisma/
│   │   ├── schema.prisma        # Database schema (source of truth)
│   │   ├── migrations/           # Versioned migration history
│   │   └── seed.ts               # Idempotent seed script
│   ├── src/
│   │   ├── modules/              # Feature modules (auth, orders, etc.)
│   │   ├── common/               # Cross-cutting (guards, filters, pipes)
│   │   ├── config/               # Env validation, logger, Prisma, Redis
│   │   └── main.ts               # Bootstrap
│   ├── test/                     # E2E tests
│   └── scripts/                  # Operational scripts (backup, kill-locks)
├── src/                          # Frontend (TanStack Start)
│   ├── routes/                   # File-based routing
│   ├── components/               # React components
│   ├── lib/                      # API client, stores, utilities
│   └── hooks/                    # Custom React hooks
├── docker-compose.yml            # Base compose for dev + prod
├── docker-compose.prod.yml       # Production overlay (resource limits, no public backend port)
├── .github/
│   ├── workflows/ci.yml          # CI/CD pipeline
│   ├── CODEOWNERS                # Who reviews what
│   └── dependabot.yml            # Weekly dependency PRs
├── infra/
│   └── grafana/                  # Grafana dashboard JSON
├── ops/                          # Operational docs (Sentry, log shipping)
├── DEPLOY.md                     # Production deployment guide
├── SECURITY.md                   # Vulnerability disclosure policy
├── RUNBOOK.md                    # Incident response procedures
└── CONTRIBUTING.md               # This file
```

## Branching and PR process

We use **trunk-based development** with short-lived feature branches:

1. Cut a branch from `main`:
   ```bash
   git checkout main
   git pull
   git checkout -b feat/short-description
   ```
2. Commit in small, focused chunks with clear messages (see below).
3. Push and open a PR against `main`.
4. The CI workflow (`.github/workflows/ci.yml`) runs:
   - Lint + typecheck (both apps)
   - Backend unit + E2E tests
   - Frontend build
   - Schema-diff check
   - Docker build + push to GHCR
   - Deploy job (only on `main`)
5. Request a review from the relevant `CODEOWNERS`. At least one approval is required.
6. After approval, **squash-merge** your PR. The squash commit becomes the canonical history.

Branch naming:
- `feat/<thing>` — new feature
- `fix/<thing>` — bug fix
- `chore/<thing>` — refactoring, tooling, docs (no production behaviour change)
- `hotfix/<thing>` — urgent fix to production (skip the normal review if needed)

## Commit message conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/). This lets us auto-generate changelogs and makes the git log greppable.

```
<type>(<scope>): <description>

<body>

<footer>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`

Examples:
```
feat(cart): coalesce add() actions by variant id
fix(orders): preserve coupon usage on cancellation rollback
chore(deps): bump @nestjs/core to 11.0.1
docs(runbook): add Redis failover section
```

Scope is optional but encouraged for larger codebases. Use the module name (`auth`, `orders`, `cart`, `webhooks`, `seo`, etc.) or the frontend component name.

The body explains *why* (not *what* — the diff shows what). The footer can reference issues (`Closes #123`) or note breaking changes (`BREAKING CHANGE: ...`).

## Code style

### Linting and formatting

Both apps use ESLint + Prettier. Before opening a PR:

```bash
# Frontend
bun run lint
bun run format

# Backend
cd backend && npm run lint && npm run format
```

CI will fail if `npm run lint` reports any errors. Warnings are tolerated for now.

### TypeScript

- `strict: true` is enabled in both `tsconfig.json` files
- Prefer explicit types over `any`. Use `unknown` + a type guard when the type isn't known statically
- Use `interface` for object shapes, `type` for unions and computed types
- Prefer readonly fields and immutability where possible

### Backend conventions

- **One module per business concept** (`auth`, `orders`, `payments`, `webhooks`, etc.)
- **Thin controllers, fat services** — controllers do request/response validation only
- **Use DTOs for everything that crosses the network** — `class-validator` for validation, `class-transformer` for serialization
- **Use Prisma transactions for any multi-row mutation**
- **Inject config via the `ConfigService`** — never read `process.env` directly outside `env.config.ts`
- **Email as side-effect** — transactional email sends belong in services, not in controllers
- **Logging via the Winston instance** — `app.useLogger(...)` is set in `main.ts`; the `Logger` class from `@nestjs/common` delegates to it

### Frontend conventions

- **File-based routing** — every URL has a file in `src/routes/`. Use TanStack Router conventions (`__root.tsx`, `routeTree.gen.ts` is auto-generated).
- **Server data via TanStack Query** — `useQuery` / `useMutation`, never `useEffect` + `fetch`
- **State management:**
  - URL state → TanStack Router search params
  - Server state → TanStack Query
  - Cross-component UI state → Zustand store (see `src/lib/store/`)
  - Component-local state → `useState`
- **API calls go through `apiClient`** (`src/lib/api/client.ts`). It handles:
  - Auth cookie attachment (`credentials: 'include'`)
  - JSON serialization
  - CSRF token attachment for mutations
  - Error normalization (Axios-style `err.response.data.message` → `Error.message`)
- **No `any` in new code** — the `no-explicit-any: error` rule will be tightened in Phase 10 follow-up

### Accessibility

- Every interactive element has a visible focus ring (use Tailwind's `focus-visible:` utilities)
- Color contrast meets WCAG AA (4.5:1 for normal text, 3:1 for large text)
- Modals use `role="dialog"` and `aria-modal="true"`; trap focus inside
- All form inputs have associated `<label>` elements
- Icon-only buttons have `aria-label` descriptions

## Testing

### Backend

```bash
cd backend

# Run unit tests
npm test

# Run with coverage
npm run test:cov

# Run E2E tests (requires Postgres + Redis running)
npm run test:e2e

# Run a single test file
npm test -- --testPathPattern=cart
```

Tests use Jest. We use real Postgres + Redis via testcontainers for E2E (not mocks). New features must come with at least one test exercising the happy path.

### Frontend

Frontend testing is in Phase 9+ scope. For now:

- The build (`bun run build`) catches most type errors
- Visual regression testing should be done by running `bun run dev` and clicking through the affected pages

## Code review checklist

When reviewing a PR, check:

- [ ] Does the diff match the PR description?
- [ ] Are the tests adequate? At minimum: one happy-path test, one error-path test
- [ ] Does it touch any files listed in `.github/CODEOWNERS` that weren't already reviewed?
- [ ] Is there any PII or secret in the diff? (Search for `password`, `token`, `secret`, `AKIA`)
- [ ] If it adds a new dependency: is it justified? Could we use an existing dep instead?
- [ ] If it adds a new env var: is it documented in `backend/.env.example` or `.env.example`?
- [ ] If it adds a new metric: is it named consistently with existing metrics?
- [ ] If it adds a new endpoint: is it rate-limited? Auth-guarded where appropriate?
- [ ] If it touches the database: is there a matching Prisma migration?

## Common pitfalls

- **Don't run `prisma migrate reset` in production** — it drops all data. Use `prisma migrate resolve --rolled-back` instead.
- **Don't edit `schema.prisma` without creating a migration.** The CI schema-diff job will catch this and fail the build.
- **Don't use `process.env` directly outside `env.config.ts`.** The Zod schema validates env vars at boot — bypassing it loses the safety check.
- **Don't store tokens in `localStorage`.** The whole point of httpOnly cookies is to keep tokens out of JavaScript. If you need a client-side flag, use a separate non-sensitive cookie or `sessionStorage`.
- **Don't trust `req.user.id` to be the same as `req.user.email`.** Always look up the fresh user record when you need the email (it can change).
- **Don't log PII.** The Winston PII filter catches common patterns, but it's not exhaustive. Before adding a new log line, ask: "would I be comfortable if this leaked?"
- **Don't disable lint rules without a comment explaining why.** If you must, add `// eslint-disable-next-line <rule> -- <reason>`.
- **Don't merge your own PR.** Even if you're the only maintainer right now, wait for a second reviewer to look. (Future-you will thank present-you.)

## Getting help

- **Slack**: `#eng-aura` in our workspace
- **Email**: `engineering@aurastreetwear.com`
- **GitHub Discussions**: for design questions and proposals
- **GitHub Issues**: for concrete bugs and feature requests

For security issues, see [`SECURITY.md`](SECURITY.md) — please don't file public issues.
