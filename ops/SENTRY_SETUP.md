# Sentry setup

The frontend and backend both emit Sentry events when the relevant env vars are set. This document explains how to wire Sentry up end-to-end so the stack traces that arrive in your dashboard show real `src/...` line numbers instead of minified bundle offsets.

## 1. Create the projects

In your Sentry organisation, create **two** projects — one for each deployment target.

| Project name | Platform | Suggested team |
|--------------|----------|----------------|
| `aura-frontend` | JavaScript / React | Web / Storefront |
| `aura-backend` | Node.js (NestJS) | Backend / API |

You'll need the project DSN for both — they look like `https://...@o000.ingest.sentry.io/123`.

## 2. Create an internal integration auth token

This is what the GitHub Actions workflow uses to upload source maps. In Sentry:

1. Settings → Integrations → Internal Integrations → New Internal Integration
2. Name: "Aura CI"
3. Permissions: enable **Project → Write** and **Organization → Read**
4. Save and copy the auth token.

Keep this secret. You'll add it to GitHub in step 5.

## 3. Frontend env vars

Frontend env vars are **public** — they ship in the JS bundle. Only put DSNs here, never auth tokens.

| Var | Example | Required |
|-----|---------|----------|
| `VITE_SENTRY_DSN` | `https://...@o000.ingest.sentry.io/111` | yes |
| `VITE_SENTRY_UPLOAD` | `true` (set in CI only) | yes (CI) |
| `SENTRY_AUTH_TOKEN` | `sntrys_...` | yes (CI only, never set in `.env`) |
| `SENTRY_ORG` | `your-org-slug` | yes (CI only) |
| `SENTRY_PROJECT` | `aura-frontend` | optional, defaults to `aura-frontend` |

The DSN is what the running app uses to send events. The auth token is only used at build time by `@sentry/vite-plugin` to upload source maps.

Add the public vars to your `.env`:

```bash
VITE_SENTRY_DSN=https://...@o000.ingest.sentry.io/111
```

## 4. Backend env vars

| Var | Example | Required |
|-----|---------|----------|
| `SENTRY_DSN` | `https://...@o000.ingest.sentry.io/222` | yes |
| `SENTRY_AUTH_TOKEN` | `sntrys_...` | only if you want server-side source maps (Node.js doesn't need them but it helps symbolicate stack traces from production logs) |

Add to `backend/.env`:

```bash
SENTRY_DSN=https://...@o000.ingest.sentry.io/222
```

## 5. GitHub repository secrets

Settings → Secrets and variables → Actions → New repository secret.

| Secret | Used by | Where the value comes from |
|--------|---------|----------------------------|
| `VITE_API_URL` | Docker build args (frontend) | The URL your frontend uses to call the API in production |
| `VITE_SITE_URL` | Docker build args | Your canonical frontend origin |
| `VITE_RAZORPAY_KEY_ID` | Docker build args | Razorpay live key ID |
| `VITE_SENTRY_DSN` | Docker build args + workflow env | Frontend DSN from step 3 |
| `VITE_SENTRY_UPLOAD` | Workflow env | Literal `true` |
| `SENTRY_AUTH_TOKEN` | Workflow env | Auth token from step 2 |
| `SENTRY_ORG` | Workflow env | Your Sentry org slug |
| `SENTRY_PROJECT` | Workflow env | `aura-frontend` |
| `SENTRY_DSN` | Workflow env (backend image) | Backend DSN from step 4 |
| `AWS_DEPLOY_ROLE` | Deploy job | OIDC role ARN for cloud deploy |
| `AWS_REGION` | Deploy job | e.g. `ap-south-1` |

The workflow file (`.github/workflows/ci.yml`) already references all of these.

## 6. Verify the wire-up

After the first deploy:

1. Hit your frontend in production
2. Open the browser console — you should see no Sentry errors
3. In Sentry → Issues, you should see a "test event" or the first page-load as a transaction
4. Open one of those events → check the stack trace. If you see `src/components/...` paths and real line numbers, source maps are working.

If you see minified bundle offsets (e.g. `app.js:1:12345`), the source map upload didn't run — check the GitHub Actions log for the `Build + Push Docker Images` job. The `@sentry/vite-plugin` step will print an upload confirmation or an error.

## 7. Recommended alerts

Configure these in Sentry → Alerts:

| Alert | Condition | Why |
|-------|-----------|-----|
| Page errors | Any new error from `aura-frontend` | Generic 5xx-on-page alert |
| API 5xx spike | > 10 errors / 5min in `aura-backend` | Backend regression |
| Circuit breaker open | `aura_payment_circuit_open == 1` for > 1min | Razorpay outage — every checkout will fail until it closes |
| Cart Redis fallback spike | > 100 events / 5min | Redis is down or degraded |
| Email queue backed up | (custom — see `LOG_SHIPPING.md`) | Email worker is stuck |

Most of the alerts above are better as Grafana alerts (since the metrics come from Prometheus). Use Sentry only for app-level exceptions.

## 8. GDPR / privacy

The PII filter in `src/lib/api/client.ts` and `backend/src/common/sentry/sentry-pii-filter.ts` strips the obvious offenders (passwords, tokens, IP addresses). But:

- `sendDefaultPii: false` is set in both clients — explicit user context (email, IP) is never sent unless you opt in.
- If you add `Sentry.setUser({ email, id })` anywhere in the code, you're opting in to sending PII. Document it in your privacy policy.
- Request bodies may contain user-submitted content (search queries, review text). Consider adding a beforeSend filter for those.

## 9. Cost control

Sample rates are capped at 10% in production for both traces and replays (`import.meta.env.PROD ? 0.1 : 1.0`). Errors are always captured (replaysOnErrorSampleRate = 1.0). If you exceed your quota:

- Drop `tracesSampleRate` to 0.05 or 0.02
- Drop `replaysSessionSampleRate` to 0 (only record on error)
- Set a Sentry rate limit on the project to cap daily events

The frontend never sends anything to Sentry if `VITE_SENTRY_DSN` is empty — leave it blank in dev to avoid noisy events.
