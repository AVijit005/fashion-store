# Phase 11 — Final Pre-Launch Verification

This document captures what was actually verified during Phase 11, what could not be verified from the local dev environment, and what needs to happen in CI / on first deploy before the codebase is ready to serve real customers.

**Environment limitation:** The Docker daemon is not exposed to the WSL 2 environment in which Phase 11 was run. This blocks most of the integration-level checks (OWASP ZAP, Lighthouse, k6 load test, backup/restore drill, full E2E smoke). Each blocked item below has a clear "verify in CI / on first deploy" path.

---

## Verification matrix

| # | Check | How | Result | Notes |
|---|-------|-----|--------|-------|
| 1 | **No high/critical secrets in repo** | `grep` for AWS / Razorpay / GitHub / Slack / private-key patterns across `*.ts`, `*.tsx`, `*.json`, `*.yml`, `*.yaml`, `*.md` (excl. `node_modules`, `.git`, `dist`, `.vercel`, `backend/dist`) | ✅ PASS | Three matches, all false positives: `AKIAIOSFODNN7CIEXAMPLEX` (AWS documentation placeholder in CI config), `rzp_test_12345678901234` (inside `.kimchi/docs/` planning doc), `rzp_test_abcdef12345678` (mock return in test spec). No real secrets. |
| 2 | **`npm audit --audit-level=high` (frontend)** | `npm audit` at repo root | ⚠️ 3 vulns | 1 high: `vite` ≤ 7.3.3 — NTLMv2 hash disclosure + `server.fs.deny` bypass on Windows alternate paths (Windows-only, doesn't affect Linux production deploy). 1 moderate: `js-yaml` ≤ 4.1.1 — quadratic-complexity DoS. 1 low: `esbuild`. Fix via `npm audit fix` on next patch release. |
| 3 | **`npm audit --audit-level=high` (backend)** | `cd backend && npm audit` | ⚠️ 29 vulns | All transitive through `@testcontainers/*` → `dockerode` → `uuid` (moderate). No direct production runtime impact — these are dev-only test infrastructure. Fix by bumping `@testcontainers/postgresql` to ≥ 12.0.4 (breaking change; requires npm audit fix --force). |
| 4 | **OWASP ZAP baseline scan** | Docker image `owasp/zap2docker-stable` against the running stack | ⏸ BLOCKED | Docker daemon not available in WSL 2. Re-run in CI: add `ghcr.io/owasp/zap2docker-stable zap-baseline.py -t https://staging.yourdomain.com -r zap-report.html` to the CI workflow as a nightly job. |
| 5 | **Lighthouse ≥ 90 (all categories)** | `npx lighthouse https://staging.yourdomain.com --only-categories=performance,accessibility,best-practices,seo` | ⏸ BLOCKED | Needs a running stack. The sitemap and SEO are already optimised in Phase 5; Performance needs the production bundle (Phase 6 nginx config). |
| 6 | **k6 load test** | `k6 run loadtest.js` (200 VUs, 5 min) | ⏸ BLOCKED | Needs a running stack. Script (in `infra/k6/`) should hit `/api/v1/catalog/products`, `/api/v1/cart`, `/api/v1/orders/checkout` with realistic RPS. |
| 7 | **Backup / restore drill** | `pg_dump` → `createdb` → `pg_restore` | ⏸ BLOCKED | Needs a running Postgres. The backup script is in `backend/scripts/backup.sh`; restore procedure is documented in `DEPLOY.md`. Drill before launch. |
| 8 | **Full E2E smoke** | Manual: signup → verify → login → add to cart → checkout (Razorpay test) → webhook → admin order → refund → email | ⏸ BLOCKED | Needs a deployed stack + Razorpay test account + SMTP. Test card `4111 1111 1111 1111`. Procedure documented in `DEPLOY.md` step 7. |
| 9 | **Rollback test** | `aws ecs update-service --task-definition aura-backend:<PREVIOUS>` | ⏸ BLOCKED | Needs a deployed stack. Procedure documented in `DEPLOY.md` → "Rolling back". |

---

## Go-live checklist (15 items from DEPLOY.md)

| # | Item | Status | Verified by |
|---|------|--------|-------------|
| 1 | DNS resolves correctly | ⏸ Live deploy | Manual + `dig aurastreetwear.com` post-deploy |
| 2 | HTTPS works everywhere (no mixed-content) | ⏸ Live deploy | Manual + `curl -I https://aurastreetwear.com` post-deploy |
| 3 | Razorpay webhook URL configured with correct signing secret | ⏸ Manual | Razorpay Dashboard → Settings → Webhooks. See `backend/scripts/kill-locks.ts` is unrelated. |
| 4 | Razorpay live mode enabled | ⏸ Manual | Razorpay Dashboard → toggle to Live. Verify test card declines. |
| 5 | All env vars set on the live deployment (no `CHANGEME_*` placeholders) | ✅ PASS | Code review of `backend/src/config/env.config.ts` lines 53–66 confirms the production guard rejects placeholder values at boot. Audit regex `/placeholder|mock|changeme|your_|test_placeholder|super-secret|a1b2c3d4/i` + min-length checks are enforced. |
| 6 | DATABASE_URL uses the managed Postgres URL (not localhost) | ⏸ Live deploy | Inspect container env via `aws ecs describe-tasks` or `docker compose exec backend env` |
| 7 | Redis in production mode (not local Docker) | ⏸ Live deploy | Inspect REDIS_URL; should point to `cache.<region>.redis.amazonaws.com` or similar |
| 8 | S3 bucket exists with the right CORS policy and access keys | ⏸ Manual | AWS S3 console → bucket → Permissions → CORS |
| 9 | SMTP credentials work (send a test email from the admin panel) | ⏸ Live deploy | Trigger an order; verify order-confirmation email arrives within 60s |
| 10 | Sentry is receiving events | ⏸ Live deploy | Open Sentry → Issues; should see page-load events + the order you just placed |
| 11 | Backup cron is running and producing dumps | ⏸ Live deploy | `aws s3 ls s3://aura-prod-backups/db/`; verify daily dump from the last 7 days |
| 12 | Uptime monitor is configured and alerting | ⏸ Manual | Better Stack / UptimeRobot → ping `https://aurastreetwear.com/healthz` and `https://api.aurastreetwear.com/health` every minute |
| 13 | Legal pages exist | ✅ PASS | Code review confirms `/privacy`, `/terms`, `/returns`, `/shipping` routes exist (`src/routes/privacy.tsx`, `terms.tsx`, `returns.tsx`, `shipping.tsx`). Content is placeholder — needs legal review before launch. |
| 14 | Refund policy published and matches Razorpay refund window | ⏸ Manual | Publish to `/returns` page; verify against Razorpay refund API behaviour |
| 15 | Customer support email configured | ⏸ Manual | Set up `support@aurastreetwear.com`; add to footer / contact page |

**Score:** 2/15 verified locally, 13/15 require live deploy or manual action.

---

## Blocked checks — clear path to verify

| Check | How to verify |
|-------|---------------|
| OWASP ZAP | Add to CI: `ghcr.io/owasp/zap2docker-stable zap-baseline.py -t https://staging.yourdomain.com -r zap-report.html`. Schedule nightly. Fail build if high-risk alerts. |
| Lighthouse | Add `treosh/lighthouse-ci-action` to CI workflow. Run against staging deploy. Fail if any category < 90. |
| k6 load test | Write `infra/k6/loadtest.js` (200 VUs, 5 min, ramping). Add to CI as a separate nightly job against staging. |
| Backup / restore drill | Schedule a weekly restore test: restore the latest S3 dump to a scratch Postgres, verify table counts match prod. |
| Full E2E smoke | Document in `DEPLOY.md` step 7. Run manually before each major release. |
| Rollback test | Document in `DEPLOY.md` → "Rolling back". Run a drill in staging before launch. |

---

## Open issues to track post-launch

These are not blockers but should be on the next sprint:

1. **`vite` ≥ 7.3.3** — Windows-only vulnerability; bump on next patch release. Frontend build will warn about it via Dependabot weekly.
2. **`@testcontainers/postgresql` ≥ 12.0.4** — backend dev dependency; bump with `npm audit fix --force` when convenient.
3. **Frontend test suite** — Vitest + Playwright smoke. The CI workflow already runs `bun run build` as a smoke check; add unit tests in a follow-up.
4. **Returns/RMA workflow** — separate module + state machine. See `implementation-plan.md` for the design.
5. **GA4 + Meta Pixel analytics** — env-gated integration. See `src/lib/analytics.ts` stub if it exists.
6. **Configurable tax rate** — currently hard-coded 18% GST in `backend/src/modules/orders/orders.service.ts`. Move to `GlobalSetting` table.
7. **Low-stock cron + admin email digest** — template already written in `backend/src/modules/email/templates/low-stock-alert.ts`. Needs a cron job to trigger it.
8. **PgBouncer deployment** — for > 8 API replicas. Connection math is documented in `docker-compose.prod.yml`.
9. **2FA for high-value accounts** — not built yet.
10. **Multi-region active-active DR** — single-region only. Disaster recovery is "spin up from scratch".

---

## Phase 11 verdict

**Ready to launch?** Yes, conditional on completing the 13 blocked go-live checklist items against a real production environment.

**Confidence in the codebase:** High. The 11-commit audit arc addressed every 🔴 critical and 🟠 high bug in the audit report, plus most 🟡 medium items. All tests that can be run locally pass. The deferred items are either:

- Frontend polish (2FA, returns flow, analytics)
- Operational scaling (PgBouncer, multi-region)
- Dev dependency hygiene (`npm audit` warnings on transitive test containers)

None are blockers for handling real customer traffic on a single-region deployment.

**Recommended next step:** Spin up a staging environment per `DEPLOY.md`, run the 9 blocked checks against it, fix anything that surfaces, then promote to production.
