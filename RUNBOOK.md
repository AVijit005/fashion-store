# Operational Runbook

This runbook covers the scenarios you're most likely to encounter in production. Each section has: **symptoms** → **diagnosis** → **mitigation** → **prevention**.

For non-incident operations (deploys, monitoring setup), see [`DEPLOY.md`](DEPLOY.md) and `ops/LOG_SHIPPING.md`.

## How to use this document

When an alert fires:
1. Check the alert source (Grafana panel, Sentry issue, Uptime monitor)
2. Find the matching section below
3. Follow the **diagnosis** steps to confirm the cause
4. Apply the **mitigation**
5. After the incident, write a postmortem and add a runbook entry if anything was missing

For each section, "you" means the on-call engineer (which might just be you). Always have a second human review changes to production configs.

---

## 1. Backend API is down (5xx spike)

**Symptoms:**
- Uptime monitor alerts that `https://api.yourdomain.com/health` is returning non-200 or timing out
- Sentry shows a flood of `HttpException` / `InternalServerErrorException`
- Customer support is reporting checkout failures

**Diagnosis:**
```bash
# 1. Check the health endpoint directly
curl -i https://api.yourdomain.com/health

# 2. Check if the backend process is alive
# (ECS / Cloud Run)
aws ecs describe-services --cluster aura --services aura-backend

# (bare-metal)
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose logs --tail=200 backend

# 3. Check Postgres / Redis reachability from the backend network
docker compose exec backend nc -zv postgres 5432
docker compose exec backend nc -zv redis 6379
```

**Likely causes (in order of probability):**
1. Postgres is unreachable — backend can't connect
2. Redis is unreachable — auth and rate limiting fail
3. Recent deploy introduced a bug
4. Process is OOM-killed (memory leak or traffic spike)

**Mitigation:**
```bash
# If recent deploy, roll back:
aws ecs update-service --cluster aura --service aura-backend \
  --task-definition aura-backend:<PREVIOUS_REVISION>

# If Postgres / Redis is the issue, see sections 2 and 3.

# If OOM, scale up CPU/memory:
aws ecs update-service --cluster aura --service aura-backend \
  --desired-count 1  # temporarily stop auto-scaling
# Edit the task definition to increase memory from 1G to 2G, redeploy
```

**Prevention:**
- Health check endpoint probes Postgres + Redis — alerts fire before the API goes down
- Postgres and Redis are in a private network — they're not the first thing to fail
- Memory limits on each container prevent cascade failures

---

## 2. Postgres is down or unreachable

**Symptoms:**
- `/health` endpoint returns `{"status":"degraded","checks":{"database":"down"}}`
- Backend logs show `Can't reach database server` or `Connection refused`
- Customers see 500 errors on every page that touches the DB

**Diagnosis:**
```bash
# Check Postgres health from the backend container
docker compose exec backend psql "$DATABASE_URL" -c "SELECT 1"

# Check the managed Postgres service
aws rds describe-db-instances --db-instance-identifier aura-prod

# Check disk usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name FreeStorageSpace \
  --dimensions Name=DBInstanceIdentifier,Value=aura-prod \
  --start-time -PT1H --end-time -PT0H --period 300 --statistics Average
```

**Likely causes:**
1. Managed Postgres failover (AWS RDS does this automatically; takes 60–120s)
2. Disk full (writes start failing)
3. Connection limit hit (200 max)
4. Network issue between backend and DB

**Mitigation:**
```bash
# For RDS failover, wait for the failover to complete (~2 min).
# The backend should auto-recover — its connection pool retries.

# If disk is full:
aws rds modify-db-instance \
  --db-instance-identifier aura-prod \
  --allocated-storage 100 \
  --apply-immediately

# If connection limit hit:
# See section 11 — connection pool sizing.

# If network issue:
# Check security groups, NACLs, route tables.
# Use AWS Reachability Analyzer to debug.
```

**Prevention:**
- RDS Multi-AZ deployment with automatic failover
- Disk autoscaling enabled with 20% buffer
- CloudWatch alarm at 80% storage / 80% connections
- PgBouncer in front of RDS for connection multiplexing at scale

---

## 3. Redis is down or unreachable

**Symptoms:**
- `/health` returns `{"status":"degraded","checks":{"redis":"down"}}`
- Cart endpoints return errors
- Login / refresh fails (the throttler and refresh-token lookups need Redis)
- Customers see "Cart sync failed" or get logged out randomly

**Diagnosis:**
```bash
docker compose exec backend redis-cli -h redis ping
docker compose exec backend redis-cli -h redis info server | grep -E "uptime|connected_clients|used_memory"
```

**Likely causes:**
1. Redis OOM (maxmemory-policy evicting keys under load)
2. Redis restart (managed service upgrade)
3. Network blip

**Mitigation:**
```bash
# If the managed Redis is recovering (ElastiCache failover, etc.):
# Backend automatically reconnects on retry — just wait ~30s.

# If Redis is genuinely down and you can't recover it quickly:
# 1. Reduce the cart endpoint rate (temporarily disable cart sync queue)
# 2. Notify users via a banner that "cart sync may be delayed"
# 3. Bring up a fresh Redis instance from the latest snapshot

# To check failover progress:
aws elasticache describe-replication-groups \
  --replication-group-id aura-prod
```

**Prevention:**
- Use ElastiCache Multi-AZ with replication
- Set `maxmemory-policy: allkeys-lru` so memory pressure degrades gracefully
- CloudWatch alarm on `used_memory` and `evictions`
- Cart service has a built-in Redis fallback to Postgres (see `cart.service.ts`); verify it's working with the `aura_cart_redis_fallback_total` metric

---

## 4. Razorpay webhook storm / payment circuit breaker open

**Symptoms:**
- Sentry fires a spike of `Razorpay signature verification failed` errors
- Grafana shows `aura_payment_circuit_open == 1` for > 1 minute
- Customer support reports "payment succeeded but order didn't update"

**Diagnosis:**
```bash
# Check Razorpay status page
open https://status.razorpay.com

# Check our circuit breaker status via Prometheus
curl -s http://prometheus/api/v1/query?query=aura_payment_circuit_open

# Check the webhook events table for failures
docker compose exec backend psql "$DATABASE_URL" -c \
  "SELECT status, COUNT(*) FROM webhook_events WHERE created_at > NOW() - INTERVAL '10 minutes' GROUP BY status"

# Check Razorpay dashboard
open https://dashboard.razorpay.com/app/webhooks
```

**Likely causes:**
1. Razorpay is having an outage (rare but happens)
2. Someone is replaying old webhooks (test or malicious)
3. The webhook secret was rotated but our env var wasn't updated
4. Signature verification is rejecting valid webhooks (false positive)

**Mitigation:**
```bash
# If Razorpay is down: WAIT. The circuit breaker opens after 5
# consecutive failures, then refuses new attempts for 60s. Payment
# retries on the client side will succeed once Razorpay recovers.

# If webhook secret was rotated:
# 1. Update RAZORPAY_WEBHOOK_SECRET in your secret manager
# 2. Restart the backend pods (rolling restart)
# 3. Manually replay the failed webhooks from Razorpay dashboard

# If signature is consistently rejecting valid webhooks:
# Compare the secret in our env with the one in Razorpay dashboard.
# They MUST match exactly (no trailing whitespace).

# If a single user is being charged but not getting their order:
# Find their order by email and manually transition to PAID via the
# admin panel.
```

**Prevention:**
- Circuit breaker is in-process (per-pod). Move to Redis-backed at scale.
- Webhook events are deduplicated by event id (Razorpay event id is unique)
- Webhook secret rotation requires coordinated deploy — document this in RUNBOOK

---

## 5. Customer reports double-charge

**Symptoms:**
- Customer emails support saying they were charged twice
- No duplicate order in the admin panel (or two orders with same total)

**Diagnosis:**
```bash
# Find the customer by email
docker compose exec backend psql "$DATABASE_URL" -c \
  "SELECT id, email, created_at FROM users WHERE email = 'customer@example.com'"

# Find their orders
docker compose exec backend psql "$DATABASE_URL" -c \
  "SELECT id, status, razorpay_payment_id, total_amount, created_at FROM orders WHERE shipping_email = 'customer@example.com' ORDER BY created_at DESC LIMIT 10"

# Find the Razorpay payment(s) for that email
open https://dashboard.razorpay.com/app/payments?search=customer@example.com
```

**Likely causes:**
1. Customer's network blipped and they retried — Razorpay charged twice but our idempotency only catches the *checkout*, not the *payment*
2. Two browser tabs were open and both submitted
3. Our payment-capture flow has a race condition (unlikely given the Lua lock)

**Mitigation:**
```bash
# 1. Check Razorpay dashboard for actual charges
# 2. Identify which order(s) in our DB match
# 3. For genuine duplicates:
#    - Mark the duplicate order as CANCELLED in the admin panel
#    - Issue a refund via Razorpay for the cancelled order's payment
#    - The customer receives the refund email automatically
# 4. Reply to the customer with the refund reference number

# If only ONE order exists but TWO Razorpay charges:
# The customer got confused. Issue a refund for the extra charge and
# apologise — it's almost always a duplicate submit.
```

**Prevention:**
- Frontend disables the "Pay" button while the payment modal is open
- Customer receives order confirmation email within 60 seconds — if they don't, they shouldn't retry
- Idempotency key on the checkout endpoint (already in place)
- Long-term: implement a "did you actually place an order?" check before allowing retry

---

## 6. Failed database migration on deploy

**Symptoms:**
- Deploy job succeeds but `aura-backend` health checks fail
- Error in container logs: `P3009 Prisma Migrate found migrations that need to be applied`
- Backend service keeps restarting

**Diagnosis:**
```bash
# Check which migration failed
docker compose logs backend | grep -i "migration\|prisma" | tail -20

# Try running the migration manually
docker compose exec backend npx prisma migrate deploy
```

**Likely causes:**
1. Migration was created but not committed to git
2. Migration has a syntax error
3. Migration conflicts with an existing schema (e.g. column already exists)
4. Database connection timed out mid-migration

**Mitigation:**
```bash
# For (1): commit the missing migration file
# (look in backend/prisma/migrations/ for the newest directory)

# For (2): fix the migration SQL, then re-run
docker compose exec backend npx prisma migrate deploy

# For (3): mark the failed migration as rolled back, then fix manually
docker compose exec backend npx prisma migrate resolve --rolled-back <MIGRATION_NAME>

# For (4): just retry
docker compose exec backend npx prisma migrate deploy
```

**CRITICAL**: Do NOT run `prisma migrate reset` in production — it drops all data.

**Prevention:**
- Migrations should run as a one-shot step *before* the backend service starts (see CI/CD workflow)
- Test migrations against a staging DB that mirrors production schema
- Schema-diff job in CI catches `schema.prisma` edits without matching migration

---

## 7. Sentry alert — high error rate

**Symptoms:**
- Sentry fires a "High error rate" alert (e.g. > 50 errors / 5 min)
- Customer support gets a wave of "the site is broken" emails

**Diagnosis:**
1. Open the Sentry issue
2. Click "Replay" or look at the stack trace
3. Check the breadcrumbs to see what happened before the error
4. Look at the tags: `release`, `environment`, `browser`, `url`

**Likely causes (in order of frequency):**
1. Bad deploy introduced a regression → roll back (section 1)
2. New feature hits an edge case in production → hotfix
3. Third-party service (Razorpay, S3, email) is misbehaving → check that service's status page
4. Customer sent unexpected data (e.g. emoji in a field, a 10MB file upload)

**Mitigation:**
- If bad deploy → roll back via the standard process
- If hotfix needed → write the smallest possible fix, test it locally, deploy
- If third-party → see sections 2, 3, 4
- If customer data → add input validation server-side, ship a hotfix

**Prevention:**
- Sentry sample rates are at 10% in production to balance cost vs visibility
- Source maps are uploaded at build time (Phase 8) so stack traces show real line numbers
- Playwright smoke tests catch the worst regressions automatically

---

## 8. Email queue is backed up

**Symptoms:**
- Sentry fires alerts on `EmailProcessor` job failures
- Customers complain they didn't receive verification / order confirmation emails
- `aura_email_queue_pending` (custom metric, if you've added it) is growing

**Diagnosis:**
```bash
# Check the BullMQ queue length via Redis
docker compose exec backend redis-cli LLEN bull:email-queue:wait

# Check failed jobs
docker compose exec backend redis-cli ZCARD bull:email-queue:failed

# Check the email service logs
docker compose logs backend | grep -i "email\|smtp" | tail -50
```

**Likely causes:**
1. SMTP provider is down or rate-limiting
2. BullMQ worker process isn't running (workers are in a separate replica — check `RUN_WORKERS=true` on the worker service)
3. The email template has a bug that throws an exception

**Mitigation:**
```bash
# If SMTP is down:
# 1. Switch to a backup SMTP provider (e.g. SES + SendGrid fallback)
# 2. Or pause the worker until SMTP recovers

# If worker isn't running:
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  --profile workers up -d worker

# If a specific template is throwing:
# Check Sentry for the template error, fix the template, replay failed jobs
docker compose exec backend node -e "
  const Queue = require('bullmq').Queue;
  const q = new Queue('email-queue', { connection: { host: 'redis', port: 6379 } });
  q.add('send', { /* ... */ }, { delay: 0 });
"
```

**Prevention:**
- Workers are a separate service with health checks (see `docker-compose.yml`)
- SMTP provider has its own retry policy; our queue has 3 retries with exponential backoff
- Monitor queue length + failed job count with Grafana

---

## 9. High CPU on backend pods

**Symptoms:**
- Grafana shows CPU > 80% sustained on backend pods
- API latency (p95) creeping up
- Pods auto-scaling but cost is climbing

**Diagnosis:**
```bash
# Check who's calling the API
docker compose exec backend psql "$DATABASE_URL" -c \
  "SELECT count(*), path, method FROM request_logs WHERE created_at > NOW() - INTERVAL '5 minutes' GROUP BY path, method ORDER BY count DESC LIMIT 20"

# Or check Prometheus for top routes by rate
curl -s 'http://prometheus/api/v1/query?query=topk(10,sum by (route)(rate(aura_http_request_duration_seconds_count[5m])))'

# Check for runaway loops (e.g. infinite retries from a bug)
docker compose logs backend | grep -i "retry\|loop" | tail -20
```

**Likely causes:**
1. DDoS or scraper hammering an expensive endpoint
2. N+1 query bug in a recent deploy
3. Bad slow-query (missing index)

**Mitigation:**
```bash
# For DDoS / scraper:
# Enable Cloudflare rate limiting or add an IP block list

# For N+1 or slow query:
# Enable Postgres slow-query log:
docker compose exec backend psql "$DATABASE_URL" -c \
  "ALTER SYSTEM SET log_min_duration_statement = '500ms'"
docker compose exec backend psql "$DATABASE_URL" -c "SELECT pg_reload_conf()"

# Then look for slow queries in the logs
```

**Prevention:**
- p95 latency alerts in Grafana
- Slow-query log enabled in production
- Index recommendations via `pg_stat_statements`

---

## 10. Cart Redis fallback spike

**Symptoms:**
- Grafana shows `rate(aura_cart_redis_fallback_total[5m])` spiking
- Cart endpoints become slow (Postgres isn't as fast as Redis for these)

**Diagnosis:**
```bash
# Check Redis health
docker compose exec backend redis-cli ping

# Check if Redis is evicting keys under memory pressure
docker compose exec backend redis-cli info stats | grep evicted_keys
docker compose exec backend redis-cli info memory | grep -E "used_memory_human|maxmemory_human"
```

**Likely causes:**
1. Redis is OOM and evicting keys (maxmemory too low)
2. Redis is unreachable for some requests (network blip)
3. The fallback path is being hit due to a code bug

**Mitigation:**
```bash
# If OOM: scale Redis up
aws elasticache modify-replication-group \
  --replication-group-id aura-prod \
  --cache-node-type cache.r6g.large

# If network: see section 3
```

**Prevention:**
- Set Redis memory to at least 2x your working-set size
- Monitor `used_memory` and `evicted_keys`
- Alert at > 80% memory pressure

---

## 11. Connection pool exhaustion (Postgres "too many clients")

**Symptoms:**
- Backend logs: `Error: P1001: Can't reach database server` or `FATAL: too many clients already`
- Some requests fail with `connection timeout`

**Diagnosis:**
```bash
# Count active connections
docker compose exec backend psql "$DATABASE_URL" -c \
  "SELECT count(*), state FROM pg_stat_activity GROUP BY state"

# Find connections by application
docker compose exec backend psql "$DATABASE_URL" -c \
  "SELECT application_name, count(*) FROM pg_stat_activity GROUP BY application_name"
```

**Likely causes:**
1. Too many API replicas (each holds 20 conns × N = 20N)
2. Long-running queries holding connections
3. Connection leak in code

**Mitigation:**
```bash
# For (1): deploy PgBouncer in transaction mode
# See docker-compose.prod.yml for the connection math
# (max 8 API replicas before PgBouncer is required)

# For (2): identify and kill the long-running query
docker compose exec backend psql "$DATABASE_URL" -c \
  "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '5 minutes'"
docker compose exec backend psql "$DATABASE_URL" -c "SELECT pg_cancel_backend(<PID>)"

# For (3): file a bug with the leak repro
```

**Prevention:**
- PgBouncer in production (max 8 API replicas without it)
- Monitor `pg_stat_activity` connection count
- Alert at 80% of `max_connections`

---

## 12. Disk full on backend / Postgres host

**Symptoms:**
- Postgres errors: `ERROR: could not extend file: No space left on device`
- Backend can't write logs
- Container restarts

**Diagnosis:**
```bash
# On bare-metal:
df -h
du -sh /var/lib/docker

# On RDS:
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS --metric-name FreeStorageSpace \
  --dimensions Name=DBInstanceIdentifier,Value=aura-prod \
  --start-time -P1D --end-time -P0D --period 3600 --statistics Average
```

**Mitigation:**
```bash
# RDS: increase allocated storage
aws rds modify-db-instance \
  --db-instance-identifier aura-prod \
  --allocated-storage 200 \
  --apply-immediately

# Bare-metal: rotate Docker logs, prune images, expand volume
docker system prune -a
journalctl --vacuum-time=7d
```

**Prevention:**
- RDS storage autoscaling enabled
- Disk usage alarm at 80%
- Docker log rotation configured

---

## 13. Customer reports data exposure / account takeover

**Symptoms:**
- Customer emails saying "someone else used my account"
- Audit log shows logins from unknown IPs
- Sentry fires on suspicious auth patterns

**Diagnosis:**
1. Pull the user's session history:
```bash
docker compose exec backend psql "$DATABASE_URL" -c \
  "SELECT id, ip_address, user_agent, is_revoked, created_at FROM sessions WHERE user_id = '<UID>' ORDER BY created_at DESC LIMIT 20"
```

2. Check the user's audit log:
```bash
docker compose exec backend psql "$DATABASE_URL" -c \
  "SELECT action, details, ip_address, created_at FROM audit_logs WHERE user_id = '<UID>' ORDER BY created_at DESC LIMIT 50"
```

3. Pull the user's recent orders:
```bash
docker compose exec backend psql "$DATABASE_URL" -c \
  "SELECT id, shipping_email, total_amount, created_at FROM orders WHERE user_id = '<UID>' ORDER BY created_at DESC LIMIT 20"
```

**Mitigation:**
1. Immediately revoke all sessions for the affected user:
```bash
docker compose exec backend psql "$DATABASE_URL" -c \
  "UPDATE sessions SET is_revoked = true WHERE user_id = '<UID>' AND is_revoked = false"
```

2. Force a password reset (via the auth flow or directly):
```bash
docker compose exec backend psql "$DATABASE_URL" -c \
  "UPDATE users SET password_hash = '<NEW_HASH>' WHERE id = '<UID>'"
# Generate NEW_HASH with: node -e "require('argon2').hash('NEW_PASSWORD').then(console.log)"
```

3. Email the customer — let them know what happened and what steps you've taken.

4. File a security incident report (see `SECURITY.md`).

**Prevention:**
- Rate limiting on login (already in place)
- Sentry alerts on suspicious IP changes (not yet built)
- 2FA (not yet built — Phase 10 follow-up)

---

## 14. Backend deploy hung / never goes green

**Symptoms:**
- GitHub Actions deploy job stuck for > 30 minutes
- ECS service in steady-state but new tasks fail health checks

**Diagnosis:**
```bash
# Check ECS service events
aws ecs describe-services --cluster aura --services aura-backend \
  --query 'services[0].events'

# Check recent task failures
aws ecs list-tasks --cluster aura --service-name aura-backend \
  --desired-status STOPPED --query 'taskArns' --output text | \
  xargs -I {} aws ecs describe-tasks --cluster aura --tasks {}
```

**Likely causes:**
1. Health check failing (DB or Redis unreachable)
2. Crashloop from a bad env var or migration
3. Image pull failure (network or registry auth)

**Mitigation:**
```bash
# For crashloop: check container logs
aws logs tail /ecs/aura-backend --follow --since 10m

# For image pull: re-authenticate to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u <user> --password-stdin

# For DB / Redis: see sections 2 and 3

# As a last resort: force-rollback the deploy
aws ecs update-service --cluster aura --service aura-backend \
  --task-definition aura-backend:<PREVIOUS_WORKING_REVISION>
```

**Prevention:**
- The CI smoke test catches many of these automatically
- Runbook each scenario before it becomes an incident
