# Deployment Guide

This is the step-by-step guide to deploying Aura Streetwear to a real production environment. It assumes a basic cloud setup (AWS / GCP / Azure / Hetzner / DigitalOcean) with managed Postgres and Redis, plus a Razorpay live account and an email provider.

If you want a fully managed setup, the easiest path is **Railway** or **Render** — they handle all of the infra glue and you only configure the env vars. For more control, see "Bare-metal / VPS" below.

## Prerequisites

Before you start, you need:

| What | Where to get it |
|------|-----------------|
| Domain with DNS access | Cloudflare, Route53, or any registrar |
| Cloud account (or VPS) | AWS, GCP, Azure, Hetzner, DigitalOcean |
| Managed Postgres 15+ | AWS RDS, GCP Cloud SQL, Neon, Supabase |
| Managed Redis 7+ | AWS ElastiCache, Upstash, Redis Cloud |
| S3-compatible object storage | AWS S3, Cloudflare R2, Backblaze B2 |
| Razorpay live account | https://dashboard.razorpay.com |
| Email provider (SMTP) | AWS SES, Resend, SendGrid, Postmark |
| Sentry account | https://sentry.io (optional but recommended) |
| GitHub repository with admin access | Already have this |

You should also have:
- A bastion host or VPN for SSH access to your VPS / containers
- A password manager (1Password, Bitwarden) to store generated secrets
- An alerting channel (Slack webhook, PagerDuty) wired to Sentry + Grafana

## Step 1 — Generate secrets

Use the secret generator from `backend/.env.example` as a checklist:

```bash
# 32-byte JWT signing secret
openssl rand -base64 64

# Database password
openssl rand -base64 32

# Redis password
openssl rand -base64 32

# MinIO / S3 access keys
openssl rand -base64 32

# Razorpay live key id + secret — get from https://dashboard.razorpay.com/app/keys
# (switch to Live mode first)

# Razorpay webhook secret — Razorpay Dashboard → Settings → Webhooks → Create Webhook
# URL: https://api.yourdomain.com/api/v1/webhooks/razorpay
# Events: order.paid, payment.captured, refund.processed
```

Store these in your password manager. You'll paste them into your cloud platform's secret manager in step 4.

## Step 2 — Provision infrastructure

### Option A — Managed services (recommended)

1. **Postgres 15+** — provision with these settings:
   - Instance: at least 2 vCPU, 4 GB RAM (the backend pool is 20 conns/pod)
   - Storage: 50 GB SSD minimum, autoscaling enabled
   - Backups: daily automated, 7-day retention minimum
   - Parameter group: `max_connections=200` (see `docker-compose.prod.yml` for full tuning)
2. **Redis 7+** — at least 1 GB RAM, `maxmemory-policy=allkeys-lru`, persistence off
3. **Object storage** — create a bucket, generate an access key + secret
4. **Container orchestration** — choose one:
   - **AWS ECS Fargate** — recommended for AWS-native, cheapest at low scale
   - **Google Cloud Run** — simplest, scales to zero
   - **Hetzner / VPS with Docker Compose** — cheapest at low scale, see "Bare-metal" below

### Option B — Bare-metal / VPS

Provision one Ubuntu 22.04 VM (4 vCPU, 8 GB RAM, 80 GB SSD) with Docker installed. See `docker-compose.prod.yml` for the full stack. SSH into the VM and:

```bash
git clone https://github.com/<your-org>/aura-streetwear.git
cd aura-streetwear
cp .env.example .env
# edit .env with the secrets from step 1
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

This gives you the full stack (frontend nginx, backend, worker, postgres, redis, minio, backup) on a single host. Good for the first $500/mo of revenue. Beyond that, move the database to a managed service.

## Step 3 — Configure DNS

| Record | Value | Purpose |
|--------|-------|---------|
| `aurastreetwear.com` | A or CNAME to your frontend | Storefront |
| `www.aurastreetwear.com` | CNAME → `aurastreetwear.com` | Redirect www → apex |
| `api.aurastreetwear.com` | A or CNAME to your backend | API |
| `cdn.aurastreetwear.com` | CNAME to your CDN | (future) Static assets |

Enable HTTPS via:
- **Cloudflare** (recommended for managed DNS + free CDN + DDoS protection)
- **Let's Encrypt** via certbot if self-hosting
- **AWS ACM** if using ALB

Set `VITE_SITE_URL=https://aurastreetwear.com` and `VITE_API_URL=https://api.aurastreetwear.com` in the frontend image build args.

## Step 4 — Configure secrets

### If using GitHub Actions + OIDC deploy (recommended)

In your GitHub repo → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|--------|-------|
| `VITE_API_URL` | `https://api.aurastreetwear.com` |
| `VITE_SITE_URL` | `https://aurastreetwear.com` |
| `VITE_RAZORPAY_KEY_ID` | Razorpay live key id |
| `VITE_SENTRY_DSN` | Sentry frontend DSN |
| `SENTRY_AUTH_TOKEN` | Sentry internal integration token |
| `SENTRY_ORG` | Sentry org slug |
| `SENTRY_PROJECT` | `aura-frontend` |
| `SENTRY_DSN` | Sentry backend DSN |
| `AWS_DEPLOY_ROLE` | ARN of the OIDC role for deploy |
| `AWS_REGION` | `ap-south-1` or your preferred region |

### Backend runtime secrets

These go into your container orchestrator's secret manager (AWS Secrets Manager, GCP Secret Manager, etc.) or directly into the `docker-compose.yml` if bare-metal:

| Secret | Value |
|--------|-------|
| `DATABASE_URL` | `postgresql://aura:<password>@<host>:5432/aura_db?schema=public&connection_limit=20&pool_timeout=30&statement_timeout=15000&lock_timeout=5000` |
| `REDIS_URL` | `redis://:<password>@<host>:6379` |
| `JWT_SECRET` | 32-byte random string |
| `RAZORPAY_KEY_ID` | Razorpay live key id |
| `RAZORPAY_KEY_SECRET` | Razorpay live key secret |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signing secret |
| `AWS_ACCESS_KEY_ID` | S3 access key |
| `AWS_SECRET_ACCESS_KEY` | S3 secret key |
| `AWS_REGION` | S3 region (e.g. `ap-south-1`) |
| `AWS_S3_BUCKET` | Bucket name |
| `EMAIL_FROM` | `Aura Streetwear <no-reply@aurastreetwear.com>` |
| `SMTP_HOST` | SMTP host (e.g. `email-smtp.ap-south-1.amazonaws.com` for SES) |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `FRONTEND_URL` | `https://aurastreetwear.com` |

## Step 5 — Run database migrations

This is a separate one-shot step before any backend replica starts. Running it inside a container on every replica boot is a known footgun.

```bash
# From your local machine, with $DATABASE_URL pointing at the production DB
DATABASE_URL=... npm run db:migrate --prefix backend
```

Or from the ECS / Cloud Run task:

```bash
aws ecs run-task \
  --cluster aura \
  --task-definition aura-backend-migrate \
  --launch-type FARGATE \
  --overrides '{"containerOverrides":[{"name":"backend","command":["npm","run","db:migrate"]}]}'
```

Verify with `\dt` in psql that the tables exist.

## Step 6 — Build + push images

The first push to `main` triggers the CI workflow defined in `.github/workflows/ci.yml`:

1. Lint + typecheck (both apps)
2. Backend test + frontend build
3. Schema-diff check
4. Docker buildx push to GHCR with `sha-${GITHUB_SHA}` tag
5. Deploy job (if all jobs pass) — uses OIDC to assume the AWS deploy role, force-deploys ECS services, smoke-tests `/healthz`

Watch the Actions tab for the first green build.

## Step 7 — Smoke test

Once the deploy job reports success:

1. Visit `https://aurastreetwear.com` — the storefront should load
2. Sign up with a test email — you should receive a verification email within 60 seconds
3. Click the verification link — you should land on `/verify-email` and see "verified"
4. Add a product to cart, proceed to checkout, select Razorpay, use test card `4111 1111 1111 1111`
5. You should receive an order confirmation email within 60 seconds
6. Check the admin panel at `https://aurastreetwear.com/admin` — the order should appear in the list
7. Issue a refund from the admin order drawer — you should receive a refund email within 60 seconds

If any step fails, check:
- `https://api.aurastreetwear.com/health` — should return `{"status":"ok","checks":...}`
- Sentry for frontend / backend errors
- `docker compose logs backend` (bare-metal) or CloudWatch logs (AWS)

## Step 8 — Configure monitoring

1. **Sentry** — you should already see events from the smoke test. Set up alerts for:
   - Page errors > 10/min
   - API 5xx errors > 5/min
   - Payment circuit breaker open > 1min
2. **Grafana** — import `infra/grafana/aura-dashboard.json` into your Grafana instance. Configure Prometheus scrape against `/api/v1/metrics`.
3. **Uptime monitoring** — set up Better Stack or UptimeRobot to ping `https://aurastreetwear.com/healthz` and `https://api.aurastreetwear.com/health` every minute.
4. **Log shipping** — see `ops/LOG_SHIPPING.md` for Docker / CloudWatch / Loki / Datadog options.

## Step 9 — Go live checklist

Before announcing the launch:

- [ ] DNS resolves correctly (apex + www → storefront, api → backend)
- [ ] HTTPS works everywhere (no mixed-content warnings in browser console)
- [ ] Razorpay webhook URL configured with the correct signing secret
- [ ] Razorpay live mode enabled (test keys won't process real payments)
- [ ] All env vars set on the live deployment (no `CHANGEME_*` placeholders)
- [ ] DATABASE_URL uses the managed Postgres URL (not localhost)
- [ ] Redis is in production mode (not local Docker)
- [ ] S3 bucket exists with the right CORS policy and access keys
- [ ] SMTP credentials work (send a test email from the admin panel)
- [ ] Sentry is receiving events
- [ ] Backup cron is running and producing dumps
- [ ] Uptime monitor is configured and alerting
- [ ] Legal pages exist: `/privacy`, `/terms`, `/returns`, `/shipping`
- [ ] Refund policy is published and matches the Razorpay refund window
- [ ] Customer support email is set up (e.g. `support@aurastreetwear.com`)
- [ ] On-call rotation exists (even if it's just you)

## Rolling back

If a deploy goes wrong, the simplest path is:

```bash
# Roll the ECS service back to the previous task definition
aws ecs update-service \
  --cluster aura \
  --service aura-backend \
  --task-definition aura-backend:<PREVIOUS_REVISION>
```

Or via the GitHub Actions UI:
1. Go to the failed workflow run
2. Click "Re-run jobs" against the last green commit

Database migrations are trickier — they don't have an automatic rollback. If a migration goes wrong, see `RUNBOOK.md` → "Failed migration".

## Scaling

| Scale | What to do |
|-------|------------|
| 0–1k orders/day | Single backend pod + single worker, the defaults in `docker-compose.prod.yml` |
| 1k–10k orders/day | Backend: 2–3 replicas. Worker: still 1 replica. Add PgBouncer. |
| 10k–100k orders/day | Backend: 5–10 replicas behind an ALB. Worker: still 1 replica (vertical scale). Move Redis to ElastiCache cluster mode. |
| 100k+/day | Horizontal scale workers (separate queues per order type). Move to managed Kubernetes. Add read replicas for Postgres. |

Each backend replica holds 20 Postgres connections, so the ceiling is `200 / 20 = 8` API replicas before you need PgBouncer. See `docker-compose.prod.yml` for the connection math.
