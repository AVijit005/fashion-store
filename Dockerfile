FROM oven/bun:1-alpine
WORKDIR /app

# Copy package and lockfile
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy project source
COPY . .

# Expose Vite dev server port
EXPOSE 8080

# Start the development server
CMD ["bun", "run", "dev", "--host", "0.0.0.0", "--port", "8080"]
