# Multi-stage build for optimized production image size
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Install curl for healthcheck
RUN apk add --no-cache curl

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

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "run", "start:prod"]
