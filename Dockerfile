# Build stage
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Copy ONLY manifests first
COPY package.json bun.lock* bunfig.toml* ./
RUN bun install --frozen-lockfile

# Copy project source and build
COPY . .
RUN bun run build

# Serve stage
FROM nginx:alpine AS runner

# Security: non-root nginx
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
