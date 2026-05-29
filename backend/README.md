# Aura Streetwear Backend Service

A production-grade, highly scalable NestJS backend powering the **Aura Streetwear** ecosystem. This service manages Identity & Access Management (argon2id + JWT + refresh token rotation), a rich Product Catalog with native PostgreSQL full-text search, persistent Checkout & Order lifecycles with transaction safety, a custom Studio Design ecosystem, local MinIO/S3 object storage, and secure Razorpay payment processing.

---

## 🛠️ Technology Stack & Architecture

- **Framework:** [NestJS](https://nestjs.com/) (v11) - modular, dependency-injected architecture
- **Database ORM:** [Prisma](https://www.prisma.io/) (v6) with PostgreSQL
- **Caching & Queues:** [Redis](https://redis.io/) (v7) via [BullMQ](https://docs.bullmq.io/) for asynchronous worker processing (e.g. reservation expirations)
- **Object Storage:** [MinIO](https://min.io/) (local S3 compatibility) / AWS S3 / Cloudflare R2
- **Payment Gateway:** [Razorpay](https://razorpay.com/) (secure SDK integration, webhook verification, and idempotency protection)
- **Security:** Helmet, CORS, Argon2id password hashing, JWT token rotation, and strict RBAC guards
- **API Documentation:** [Swagger UI](https://swagger.io/tools/swagger-ui/) (auto-generated OpenAPI schemas)
- **Logging:** Structured JSON logging via [Winston Logger](https://github.com/winstonjs/winston)

---

## ⚙️ Local Development Setup

### Prerequisites

- **Node.js** (v20 or higher)
- **npm** (v10 or higher)
- **Docker Desktop** (with WSL2 enabled if on Windows)

### Step-by-Step Setup

1. **Navigate to the Backend Directory:**

   ```bash
   cd backend
   ```

2. **Install Dependencies:**

   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy the example environment file and adjust values as needed:

   ```bash
   cp .env.example .env
   ```

   _Note: For local development, the default values in `.env.example` are pre-configured to work out-of-the-box with the Docker Compose services._

4. **Spin Up Infrastructure Services:**
   Start PostgreSQL, Redis, and MinIO in the background:

   ```bash
   docker-compose up -d
   ```

   Verify they are running:

   ```bash
   docker-compose ps
   ```

5. **Run Prisma Migrations & Seed Database:**
   Generate the Prisma Client and apply migrations to local Postgres:

   ```bash
   npx prisma migrate dev
   ```

   Seed the database with mock categories, products, and variants:

   ```bash
   npm run db:seed
   ```

6. **Start the Application:**
   Run the NestJS application in watch mode for development:
   ```bash
   npm run start:dev
   ```
   The backend server will start at `http://localhost:3000`.
   API Documentation is available at `http://localhost:3000/docs`.

---

## 📦 Docker Setup & Orchestration

The `docker-compose.yml` file defines three essential services for local development:

1. **PostgreSQL (`port 5432`):** Database named `aura_db`, user `aura_user`, password `aura_password`. Persistent data is stored in the `pgdata` volume.
2. **Redis (`port 6379`):** Key-value store used for background job queues (BullMQ) and potential caching. Data is stored in the `redisdata` volume.
3. **MinIO (`port 9000` / `9001`):** High-performance, S3-compatible object storage. Access key is `aura_admin`, secret key is `aura_password`.
   - **Port 9000:** API communication endpoint (`AWS_S3_ENDPOINT`)
   - **Port 9001:** Web administration console (credentials: `aura_admin` / `aura_password`)

### Managing Docker Containers

- **Start Services:** `docker-compose up -d`
- **Stop Services:** `docker-compose down`
- **View Container Logs:** `docker-compose logs -f [service_name]` (e.g. `docker-compose logs -f postgres`)
- **Reset Volume Data:** `docker-compose down -v` (wipes and cleans DB, Redis, and storage data)

---

## 🛢️ Prisma Migration & Database Workflow

Prisma is used for database modeling, migrations, and querying.

### Common Prisma Commands

- **Create a New Migration:**
  When you modify `prisma/schema.prisma`, run this to generate and apply a new SQL migration:
  ```bash
  npx prisma migrate dev --name <migration_name>
  ```
- **Apply Pending Migrations (Production):**
  Applies all migration files in `prisma/migrations` directly:
  ```bash
  npm run db:migrate
  ```
- **Run Prisma Studio (GUI Database Browser):**
  Opens an interactive database editor in your browser at `http://localhost:5555`:
  ```bash
  npm run db:studio
  ```
- **Force Sync Schema (Skip migrations, for local testing reset):**
  ```bash
  npx prisma db push
  ```
- **Re-run Seeds:**
  ```bash
  npm run db:seed
  ```

---

## 🪣 MinIO Object Storage Setup

We use MinIO locally to mirror AWS S3 functionality. The `StorageService` connects to MinIO via the `@aws-sdk/client-s3` SDK using path-style routing.

### Configuring MinIO Buckets

When you spin up Docker Compose, the system automatically creates the `aura-studio` bucket if it does not exist (configured in `beforeAll` for tests and checked on startup).

To manually access and manage buckets:

1. Open the MinIO Console in your browser: `http://localhost:9001`
2. Log in with:
   - **Access Key / Username:** `aura_admin`
   - **Secret Key / Password:** `aura_password`
   - **Endpoint:** `http://localhost:9000`
3. Under **Buckets**, you can view, download, or configure permissions for uploaded design assets.

---

## 🧪 Testing Commands

The backend utilizes Jest for unit and end-to-end (E2E) testing.

- **Run All Unit Tests:**
  ```bash
  npm run test
  ```
- **Run Unit Tests with Watch Mode:**
  ```bash
  npm run test:watch
  ```
- **Run Coverage Reports:**
  ```bash
  npm run test:cov
  ```
- **Run End-to-End (E2E) Tests:**
  _Ensure that Postgres, Redis, and MinIO docker containers are running before starting E2E tests._
  ```bash
  npm run test:e2e
  ```
- **Troubleshoot Open Handles (Jest):**
  If Jest fails to exit due to open database/redis handles:
  ```bash
  npx jest --config ./test/jest-e2e.json --detectOpenHandles --forceExit
  ```

---

## 🔒 Production Deployment Variables

When deploying the backend service to production (e.g. AWS ECS, Heroku, Render, DigitalOcean), the following environment variables must be documented and populated:

| Variable Name                   | Type     | Description                                            | Production Guidance                                                           |
| ------------------------------- | -------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `PORT`                          | `number` | Port on which the application runs. Default: `3000`.   | Set by hosting provider or container environment.                             |
| `NODE_ENV`                      | `string` | Environment mode: `development`, `production`, `test`. | Must be set to `production`.                                                  |
| `DATABASE_URL`                  | `string` | PostgreSQL connection string.                          | Use a managed database service (e.g., AWS RDS, Neon) with connection pooling. |
| `REDIS_URL`                     | `string` | Redis connection URL.                                  | Use a managed Redis cluster (e.g., AWS ElastiCache, Upstash).                 |
| `JWT_SECRET`                    | `string` | Secret key used to sign JWT Access and Refresh tokens. | Must be a long, randomly generated, secure string. Keep it secret.            |
| `JWT_EXPIRES_IN`                | `string` | Expiration duration for Access Tokens. Default: `15m`. | Set to `15m` for security.                                                    |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS` | `number` | Lifespan of Refresh Tokens in days. Default: `7`.      | Set to `7` or `30` depending on session policy.                               |
| `RAZORPAY_KEY_ID`               | `string` | Razorpay API Key ID.                                   | Use live Razorpay keys.                                                       |
| `RAZORPAY_KEY_SECRET`           | `string` | Razorpay API Key Secret.                               | Use live Razorpay key secrets. Keep it secret.                                |
| `RAZORPAY_WEBHOOK_SECRET`       | `string` | Razorpay webhook verification token.                   | Set to the secret token provided in Razorpay Dashboard to protect endpoint.   |
| `AWS_ACCESS_KEY_ID`             | `string` | IAM Access Key ID for S3 bucket storage access.        | Create a dedicated IAM user with minimum permissions (S3 read/write only).    |
| `AWS_SECRET_ACCESS_KEY`         | `string` | IAM Secret Access Key.                                 | Keep it secret.                                                               |
| `AWS_REGION`                    | `string` | AWS Region where the S3 bucket is hosted.              | E.g. `us-east-1`, `ap-south-1`.                                               |
| `AWS_S3_BUCKET`                 | `string` | Name of the S3 bucket.                                 | E.g. `aura-streetwear-prod-assets`.                                           |
| `AWS_S3_ENDPOINT`               | `string` | Optional S3-compatible custom endpoint.                | Leave blank for native AWS S3. Set for Cloudflare R2, MinIO, or DigitalOcean. |

---

## 📦 Production Build & Dockerfile

A multi-stage `Dockerfile` is provided in the `backend/` directory for building a slim, production-grade container.

To build the production container locally:

```bash
docker build -t aura-backend:latest .
```

To run the production container:

```bash
docker run -p 3000:3000 --env-file .env aura-backend:latest
```
