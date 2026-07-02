# Log shipping

The backend emits structured JSON logs to stdout via Winston. This document covers how to ship those logs to a centralised aggregator for search, alerting, and retention.

## What gets logged

Every request produces one structured log line on completion:

```json
{
  "level": "log",
  "timestamp": "2026-07-02T14:32:11.024Z",
  "context": "HTTP",
  "message": "POST /api/v1/orders/checkout 200 142ms",
  "method": "POST",
  "path": "/api/v1/orders/checkout",
  "status": 200,
  "statusClass": "2xx",
  "durationMs": 142.3,
  "ip": "203.0.113.42",
  "userAgent": "Mozilla/5.0 ...",
  "correlationId": "01HZ8X...",
  "userId": "abc-123",
  "contentLength": 1284
}
```

The PII mask in `backend/src/config/logger.config.ts` automatically redacts fields whose names match `password|token|secret|credit_card|email|ip|ipaddress`.

Application events from `Logger.log({ ... }, message)` use the same shape — `level: "log" | "error" | "warn" | "debug"`. Business events are emitted via `AuditService.create({ ... })` which lands in the `audit_logs` Postgres table — don't ship those to your log aggregator, query them from the database instead.

## Option A — CloudWatch (recommended for AWS)

Easiest path if you're already on AWS. The container just needs the CloudWatch agent sidecar or the awslogs Docker driver.

### Docker driver

Edit the backend service in `docker-compose.yml`:

```yaml
backend:
  logging:
    driver: awslogs
    options:
      awslogs-region: ${AWS_REGION:-ap-south-1}
      awslogs-group: aura-backend
      awslogs-stream: "$(hostname)"
      awslogs-create-group: "true"
```

Pros: zero extra infrastructure. Pros: 30-day retention is the default; need to ship to S3 for longer retention.

## Option B — Loki + Grafana

Best open-source option. Grafana already supports Loki as a datasource, so the same dashboards that pull from Prometheus can also show logs.

```yaml
services:
  # Add to docker-compose.yml
  loki:
    image: grafana/loki:2.9.0
    restart: unless-stopped
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - lokidata:/loki
    networks:
      - data

  promtail:
    image: grafana/promtail:2.9.0
    restart: unless-stopped
    command: -config.file=/etc/promtail/config.yml
    volumes:
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - ./infra/loki/promtail-config.yml:/etc/promtail/config.yml:ro
    networks:
      - data
```

Pros: stays inside the same Grafana you already have for metrics. Pros: cheap (10$/month for typical workloads). Cons: needs Promtail or similar agent.

## Option C — Datadog

Easiest SaaS option. Datadog's Node.js tracer auto-instruments Winston.

```bash
# Install the tracer (in backend/Dockerfile)
RUN npm install --save dd-trace
ENV DD_SERVICE=aura-backend
ENV DD_ENV=production
```

Add to your entrypoint:

```bash
node --require dd-trace/init dist/main.js
```

Pros: best-in-class APM, real-user monitoring, log search. Cons: expensive at scale ($30+/host/month).

## Option D — Self-hosted ELK

Skip unless you already have an existing ELK stack. Operationally expensive for the size of logs an e-commerce site produces.

## What to look for in the logs

The log aggregator is most useful for two workflows: **alerting on incidents** and **debugging individual requests**.

### Alerting queries

| Alert | PromQL / LogQL | Threshold |
|-------|----------------|-----------|
| Backend down | `count_over_time({container="aura-backend"}[5m])` | == 0 |
| High 5xx rate | `count_over_time({container="aura-backend"} \| json \| status >= 500 [5m])` | > 10 |
| Payment circuit stuck open | `aura_payment_circuit_open` (from Prometheus) | == 1 for > 1min |
| Cart Redis down | `count_over_time({container="aura-backend"} \| json \| message =~ "redis fallback" [5m])` | > 100 |

### Per-request debugging

Find a request by its `correlationId` (returned in the `x-correlation-id` response header, surfaced by `correlation-id.middleware.ts`). The same id appears in:

- The HTTP access log line (RequestLoggerMiddleware)
- Any application log emitted from that request's handlers / services
- The Sentry event if the request throws
- The `audit_logs` row if the request triggers a business event

That single id is the fastest way to answer "what happened when user X placed order Y?"

## Don't do this

A few things to avoid:

- **Don't ship `console.log` from the frontend.** Use `console.error` for client-side errors (Sentry captures them) or `toast.error` for user-visible errors. `console.log` is invisible and noisy.
- **Don't log full request bodies.** Bodies often contain passwords, addresses, payment info. Log only the fields you need.
- **Don't use the same Sentry / log aggregator project for dev and prod.** A staging deploy spiking to 10k events per minute will saturate the production quota. Use separate Sentry projects / log streams.
- **Don't store logs longer than you need them.** 30 days is usually enough for incident response. Anything older should go to cold storage (S3 + Glacier) if at all.
