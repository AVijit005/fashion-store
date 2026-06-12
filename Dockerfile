# Build stage
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Copy package and lockfile
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy project source and build
COPY . .
RUN bun run build

# Serve stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
