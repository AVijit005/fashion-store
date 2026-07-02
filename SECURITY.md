# Security Policy

This document describes how to report security vulnerabilities in Aura Streetwear, what versions are supported, and what security protections are built into the codebase.

## Reporting a vulnerability

**Please do not file a public GitHub issue for security bugs.** Instead, email:

📧 **security@aurastreetwear.com**

You should receive a confirmation within **2 business days**. If you don't, please follow up — we're committed to acknowledging every report.

When reporting, please include:

- A clear description of the issue and its impact
- Steps to reproduce, including any URLs / payloads / screenshots
- The affected version / commit SHA
- Your name / handle (so we can credit you in the fix announcement, if you'd like)

We follow [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure). We ask that you:

- Give us a reasonable window (typically 90 days) to fix the issue before public disclosure
- Don't exploit the vulnerability beyond what's needed to demonstrate it
- Don't share the vulnerability with third parties until we've published a fix

We commit to:

- Acknowledging your report within 2 business days
- Providing a status update every 7 days until the fix ships
- Crediting you in the release notes (unless you prefer to remain anonymous)
- Not pursuing legal action against good-faith security research

## Supported versions

| Version | Supported | Notes |
|---------|-----------|-------|
| Latest (`main` branch) | ✅ Full support | Security fixes ship here first |
| Previous minor release | ✅ Critical / high severity fixes | Backports only |
| Anything older | ❌ No support | Please upgrade |

We follow [semver](https://semver.org/). Breaking changes bump the major version. Security fixes may land in any release as a patch (backwards-compatible) or minor (additive).

## Security features built into the codebase

This isn't a guarantee — it's a snapshot of the protections that exist at the time of writing. Review the actual code for the current state.

### Authentication & session management
- Argon2id password hashing (memory-hard, salted)
- JWT access tokens (15-minute expiry) + opaque refresh tokens (7-day expiry)
- Refresh-token rotation with `SELECT … FOR UPDATE` row lock to prevent token-reuse races
- Per-user session rows with explicit `isRevoked` column (server-side logout works even with stolen access tokens)
- `httpOnly`, `Secure`, `SameSite=Strict` cookies for refresh tokens
- Rate limiting on `/auth/login` (5/15min), `/auth/refresh` (10/15min), `/auth/forgot-password` (3/hr), `/auth/resend-verification` (1/hr)
- Email verification required for sensitive operations (checkout, admin) — see `RequireVerifiedGuard`
- Constant-time dummy Argon2id hash on user-not-found in login (prevents timing-based enumeration)

### Payment security
- Razorpay HMAC-SHA256 signature verification on every checkout + webhook
- Webhook signature uses a *separate* secret from the API key (`RAZORPAY_WEBHOOK_SECRET`)
- Webhook idempotency: each Razorpay event id stored in `webhook_events` table; duplicates are silently dropped
- Distributed Lua-atomic Redis lock around `payment:verify:*` keys to serialize concurrent payment verification
- Order state machine with explicit transitions; `FAILED → PAID` direct jump is forbidden (must go through `PAYMENT_PENDING` first)
- Row-level `SELECT … FOR UPDATE` on `orders` during state transitions
- Sentry PII filter strips `Authorization`, `Cookie`, `password`, `token`, `credit_card`, etc. before sending events

### Frontend / transport
- HTTPS only (HSTS with `max-age=31536000` once deployed)
- CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin
- Admin deep-link guard via `beforeLoad` in TanStack Router — non-admin requests redirect before any data query fires
- Auth-gated routes protected by `RequireVerified` decorator
- Cart sync queue coalesces by item id + has max-retry + backoff
- No `localStorage`-based auth gating (we rely on `httpOnly` cookies + the server's `/auth/me`)

### Infrastructure
- PostgreSQL connection strings use `?connection_limit=20` per pod; production runs with `max_connections=200`. For > 8 API replicas, use PgBouncer in transaction mode (see `docker-compose.prod.yml`)
- Backend runs as the unprivileged `node` user (UID 1000) in Docker
- Frontend nginx runs as the `nginx` user (UID 101) via the `nginx-unprivileged` base image
- `tini` PID 1 forwards SIGTERM to Node so graceful shutdown works
- `security_opt: no-new-privileges:true` on every container in prod compose
- `read_only` root filesystem on frontend + backend where possible, with `tmpfs` for `/tmp`
- Daily Postgres backup to S3 with 30-day retention (see `backend/scripts/backup.sh`)
- Container images pinned to specific versions (no `latest`)

### Secrets management
- All secrets loaded from env vars; never committed to git
- Placeholder values in `backend/.env.example` trip the production guard (`/placeholder|changeme|your_|test_placeholder|super-secret|a1b2c3d4/i` + length checks) so a deploy with missing secrets crashes the process at boot instead of starting insecurely
- CI/CD uses GitHub OIDC to assume AWS deploy roles — no long-lived AWS access keys in repo secrets
- Frontend `.env` files are gitignored; production builds read `VITE_*` from CI build args
- Example values in `backend/.env.example` use obvious placeholders (`CHANGEME_*`) so they can't accidentally be deployed

## What we do NOT do (limitations you should know)

- **No rate limiting at the CDN level.** The app-level rate limiter (Redis-backed Throttler) works, but a determined attacker could exceed it before hitting the app. Use Cloudflare or your CDN's rate-limiting rules for an outer layer.
- **No WAF.** Application-level protections only. Consider adding AWS WAF or Cloudflare's WAF rules in production.
- **No automated dependency scanning in production** beyond the Dependabot PRs. We recommend running `npm audit` weekly in production and reviewing results.
- **No penetration testing.** The code has been designed with security in mind but has not been tested by an external security firm. Budget for a pentest before handling significant customer PII.
- **Single-region deployment.** Disaster recovery is "spin up from scratch in another region" — not zero-downtime. Multi-region active-active would require additional infrastructure.
- **Self-hosted backups are not encrypted at rest.** Database dumps in S3 use the default S3 encryption, but consider adding SSE-KMS for sensitive workloads.

## Security update cadence

| Severity | SLA |
|----------|-----|
| Critical (RCE, auth bypass, payment bypass) | Patch within 24 hours |
| High (data exposure, privilege escalation) | Patch within 7 days |
| Medium (information disclosure, XSS without token theft) | Patch within 30 days |
| Low (best-practice violations) | Patch at next regular release |

Security patches are announced in:
- GitHub Releases (with `SECURITY:` prefix in the changelog)
- The `#security-announcements` channel in our Slack workspace
- security-announcements@aurastreetwear.com mailing list (subscribe by emailing `subscribe-security-announcements@aurastreetwear.com`)

## Acknowledgements

We thank the following researchers for responsibly disclosing security issues (most recent first):

*(No public disclosures yet.)*

If you report a valid issue, we'll add you here (with your permission) when we publish the fix.

## Related documents

- [`DEPLOY.md`](DEPLOY.md) — production deployment guide
- [`RUNBOOK.md`](RUNBOOK.md) — operational runbook for incidents
- [`ops/SENTRY_SETUP.md`](ops/SENTRY_SETUP.md) — Sentry configuration
- [`ops/LOG_SHIPPING.md`](ops/LOG_SHIPPING.md) — log aggregator options
- [`.github/CODEOWNERS`](.github/CODEOWNERS) — who reviews what
