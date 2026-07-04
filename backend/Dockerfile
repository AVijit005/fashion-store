# Multi-stage build for optimized production image size
FROM node:20.18-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:20.18-alpine AS runner

WORKDIR /usr/src/app

# Install curl for healthcheck + tini for proper signal forwarding to Node workers
# (BullMQ workers run in the same process; without tini, SIGTERM is not propagated
# and `docker stop` will hard-kill the process after 10s grace, orphaning queue jobs.)
RUN apk add --no-cache curl tini

# Change ownership of working directory to node user
RUN chown -R node:node /usr/src/app

# Switch to non-root user
USER node

COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma ./prisma/

RUN npm ci --omit=dev
RUN npx prisma generate

COPY --chown=node:node --from=builder /usr/src/app/dist ./dist
COPY --chown=node:node scripts ./scripts

EXPOSE 3000

# Probe the deep health endpoint so orchestrators see DB/Redis failures, not
# just "the process is alive".
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# tini forwards SIGTERM to Node, enabling graceful shutdown via Nest's
# enableShutdownHooks(). The CMD only starts the application — migrations
# are a separate `npm run db:migrate` step run before the service starts.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npm run db:migrate && exec node dist/main.js"]
