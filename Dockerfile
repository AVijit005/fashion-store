# Aura Streetwear — Frontend (TanStack Start / React 19)
#
# Multi-stage build:
#   1. builder: install deps, run `vite build`. Output goes to
#      `.vercel/output/static/` (Nitro's Vercel preset, NOT `dist/`).
#   2. runner: nginx-unprivileged serving the static bundle on port 8080
#      with a custom config that adds security headers and SPA fallback.
#
# IMPORTANT: This image was previously broken — it copied `/app/dist` (which
# Vite does NOT create; the Nitro preset writes to `.vercel/output/static/`).
# The nginx container shipped empty. That bug (C-S7 in the audit) is fixed
# here.

# ---------- Stage 1: build ----------
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Build-time env vars. These are inlined into the JS bundle by Vite at build
# time — they are NOT runtime variables. Bake them via `docker build --build-arg`.
ARG VITE_API_URL=http://localhost:3000
ARG VITE_SITE_URL=http://localhost:8080
ARG VITE_RAZORPAY_KEY_ID
ARG VITE_SENTRY_DSN

ENV VITE_API_URL=$VITE_API_URL \
    VITE_SITE_URL=$VITE_SITE_URL \
    VITE_RAZORPAY_KEY_ID=$VITE_RAZORPAY_KEY_ID \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    CI=true

# Copy manifests first for layer caching
COPY package.json bun.lock* bunfig.toml* ./
RUN bun install --frozen-lockfile

# Now the source — invalidate only when source changes
COPY . .
RUN bun run build

# ---------- Stage 2: serve ----------
# nginx-unprivileged ships as user `nginx` (UID 101) and listens on 8080 by
# default. No root process in the container.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner

# Copy the static bundle produced by the Nitro / Vercel preset.
# Vite outputs here, NOT to /app/dist (the prior Dockerfile had this wrong).
COPY --from=builder /app/.vercel/output/static /usr/share/nginx/html

# Custom nginx config: SPA fallback, security headers, gzip, healthcheck.
COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

# Orchestrator healthcheck — must hit a path that doesn't require external deps.
# The /healthz endpoint in nginx-frontend.conf returns 200 "ok" without
# touching the backend.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/healthz >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
