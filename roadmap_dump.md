=================================================
PHASE 1
=======

Objective
Stop the bleeding. Eradicate all vulnerabilities that lead to direct financial loss, inventory corruption, duplicate processing, and active exploitation of the transactional layer.

Why it matters
If the application goes live without these fixes, it is mathematically guaranteed to lose money through Razorpay discrepancies, oversell out-of-stock items, process duplicate orders, and fall victim to XSS or SQL Injection attacks. The business cannot operate safely until Phase 1 is complete.

Issues Included
Transaction race conditions, payment verification bugs, empty webhook secrets, active XSS surfaces, SQL injection risks, and JWT forgery.

Table:

| ID | Severity | Reason | Estimated Effort |
| -- | -------- | ------ | ---------------- |
| BE-001 | CRITICAL | Race condition in checkout creating double orders | 1 hour |
| BE-002 | CRITICAL | Inventory overselling between cart and checkout | 4 hours |
| SEC-001 | CRITICAL | JWT token forgery / Weak defaults (Account Takeover) | 30 mins |
| SEC-003 | CRITICAL | Empty Razorpay webhook secret allows forged payments | 30 mins |
| Q-001 | CRITICAL | Job idempotency failure restoring inventory twice | 2 hours |
| PAY-002 | CRITICAL | Lack of idempotency on Verify-Payment endpoint | 1 hour |
| FE-001 | CRITICAL | Razorpay test key / secret exposure to frontend | 1 hour |
| FE-002 | CRITICAL | Inline scripts enabling XSS via Razorpay load | 2 hours |
| PAY-003 | HIGH | Razorpay order amount rounding precision bug (Loss of funds) | 1 hour |
| BE-008 | HIGH | Idempotency key deletion leading to duplicate orders on retry | 1 hour |
| BE-009 | HIGH | SQL Injection risk in coupon validation ($queryRawUnsafe) | 1 hour |
| PAY-004 | HIGH | COD orders reserve inventory indefinitely without confirmation | 2 hours |
| API-003 | HIGH | Malformed webhook payloads crashing handler | 1 hour |
| SEC-009 | MEDIUM | Idempotency key replay window too large (24h) | 30 mins |
| PAY-007 | MEDIUM | Payment failure not clearing cart | 30 mins |

Execution Order
1. Security/Exploits (`SEC-001`, `SEC-003`, `BE-009`, `FE-002`, `FE-001`)
2. Payment/Revenue logic (`PAY-003`, `PAY-002`, `PAY-007`, `API-003`)
3. Concurrency/Inventory (`BE-001`, `BE-002`, `Q-001`, `BE-008`, `SEC-009`)
4. Business Logic (`PAY-004`)

Dependencies
Requires isolated staging environment connected to Razorpay Sandbox.

Testing Requirements
Heavy concurrent load testing on the `/checkout` endpoint. Automated verification of database states simulating dropped webhooks and duplicated client retries.

Rollback Considerations
High risk of schema locks if advisory locks are not implemented correctly. Ensure database migrations (if any) are strictly backward compatible. Code can be reverted with zero schema changes.

Expected Risk Reduction
Reduces catastrophic business risk by 95%. Guarantees safe money capture and inventory allocation.

=================================================
PHASE 2
=======

Objective
Secure user sessions and close the authentication perimeter.

Why it matters
With payments secured, the next vector of attack is the user's account. Without CSRF protection, strict rate limiting, and safe session rotation, attackers can hijack sessions, steal PII, or execute unauthorized actions on behalf of legitimate users.

Issues Included
CORS misconfigurations, rate limiting bypasses, CSRF token gaps, refresh token race conditions, and malicious file uploads.

Table:

| ID | Severity | Reason | Estimated Effort |
| -- | -------- | ------ | ---------------- |
| SEC-002 | CRITICAL | CORS `origin: true` allowing full credential reflection | 1 hour |
| SEC-004 | CRITICAL | Rate limiter uses in-memory store; brute force vulnerable | 2 hours |
| SEC-005 | HIGH | Refresh token rotation race condition allowing replays | 2 hours |
| SEC-007 | HIGH | No CSRF protection on state-changing endpoints | 3 hours |
| SEC-006 | HIGH | Password reset tokens not invalidated on use | 2 hours |
| SEC-008 | HIGH | File upload MIME type bypass (Stored XSS risk) | 1 hour |
| BE-012 | MEDIUM | Missing input validation on shipping address fields | 1 hour |
| RED-005 | MEDIUM | Throttler lacking Redis storage configuration | 1 hour |
| SEC-012 | MEDIUM | Missing strict HTTP security headers (CSP, COEP) | 1 hour |

Execution Order
1. Perimeter Defenses (`SEC-002`, `SEC-004`, `RED-005`, `SEC-012`)
2. Session Integrity (`SEC-005`, `SEC-006`, `SEC-007`)
3. Input Sanitization (`SEC-008`, `BE-012`)

Dependencies
Requires Redis cluster to be operational (for distributed rate limiting).

Testing Requirements
Fuzzing of upload endpoints. Scripted concurrent login attempts to verify token rotation locks. Cross-origin request simulations.

Rollback Considerations
Enabling strict CORS or CSRF can inadvertently break legitimate frontend requests if origin lists or token synchronization is misconfigured. Rollback is a rapid config toggle.

Expected Risk Reduction
Eliminates ATO (Account Takeover), brute force credentials stuffing, and CSRF vectors.

=================================================
PHASE 3
=======

Objective
Fortify the underlying data stores (PostgreSQL, Redis, BullMQ) and ensure strict data integrity constraints.

Why it matters
If the application crashes, the data must remain consistent. Missing database constraints, lack of connection retry logic, and absent Dead Letter Queues mean transient infrastructure failures will permanently orphan data or corrupt state.

Issues Included
Missing unique constraints, missing foreign keys, Redis HA configuration, queue error handling, and frontend state sync races.

Table:

| ID | Severity | Reason | Estimated Effort |
| -- | -------- | ------ | ---------------- |
| DB-001 | CRITICAL | Missing partial unique constraint on active carts | 1 hour |
| BE-003 | CRITICAL | Order expiry misses inventory restore for custom items | 1 hour |
| RED-001 | CRITICAL | No Redis Connection Pool / Retry Config (Blip = crash) | 30 mins |
| RED-002 | HIGH | No Redis Sentinel/Cluster configuration for HA | 4 hours |
| DB-002 | HIGH | No Foreign Key/Enum on Order.paymentProvider | 1 hour |
| DB-003 | HIGH | OrderItem.productVariantId missing mutual exclusivity | 1 hour |
| BE-006 | HIGH | Cart merge on login concurrent race condition | 1 hour |
| BE-007 | HIGH | No Dead Letter Queue for failed BullMQ jobs | 1 hour |
| Q-002 | HIGH | Payment webhooks not prioritized in queue | 1 hour |
| FE-003 | HIGH | Cart state sync race condition (Frontend/Backend desync) | 2 hours |
| FE-004 | HIGH | No Error Boundary for Checkout crashing full app | 1 hour |
| DB-006 | MEDIUM | Inconsistent soft delete patterns (Risk of leaking deleted data) | 2 hours |
| BE-010 | MEDIUM | No Circuit Breaker on Razorpay API Calls | 2 hours |

Execution Order
1. Schema Constraints (`DB-001`, `DB-002`, `DB-003`, `DB-006`)
2. Infrastructure Resilience (`RED-001`, `RED-002`, `BE-010`)
3. Async Process Safety (`BE-007`, `Q-002`, `BE-003`, `BE-006`)
4. Client Resiliency (`FE-003`, `FE-004`)

Dependencies
Requires database migration windows. Requires Redis downtime if shifting to Sentinel/Cluster.

Testing Requirements
Chaos engineering: terminate Redis instances mid-request, force BullMQ job failures, simulate network drops during checkout. 

Rollback Considerations
Database constraint migrations can block if data is already corrupt. Pre-migration cleanup scripts must be run.

Expected Risk Reduction
Ensures system survives node failures, network blips, and API outages without requiring manual database surgery.

=================================================
PHASE 4
=======

Objective
Scale the platform to support >10,000 concurrent users via query optimization and aggressive caching.

Why it matters
The application currently suffers from severe N+1 query patterns and cache stampedes. A minor traffic spike (e.g., a product drop) will immediately exhaust connection pools and take down the database.

Issues Included
N+1 queries, Prisma pooling, Cart cache TTLs, cache invalidation, table indexing, and static asset delivery.

Table:

| ID | Severity | Reason | Estimated Effort |
| -- | -------- | ------ | ---------------- |
| PERF-001 | CRITICAL | N+1 in cart hydration crashing DB on large carts | 2 hours |
| BE-004 | HIGH | N+1 query in order listing history | 2 hours |
| BE-005 | HIGH | Cart cache stampede on Redis cold start (Thundering Herd) | 2 hours |
| DB-004 | HIGH | Missing DB Index on RazorpayPaymentId (Table scans) | 15 mins |
| RED-003 | HIGH | Cart Cache TTL Too Long (14 Days -> Stale Pricing) | 15 mins |
| PERF-002 | HIGH | Prisma connection pool exhaustion / lack of config | 1 hour |
| PERF-003 | HIGH | No Prisma statement_timeout (Hung queries) | 30 mins |
| DB-005 | MEDIUM | No table partitioning strategy on Audit Logs | 4 hours |
| RED-004 | MEDIUM | No cache invalidation on Product Updates | 2 hours |
| PERF-004 | MEDIUM | Frontend JS bundle bloat / lacking code splitting | 2 hours |
| PERF-005 | MEDIUM | No CDN configured for heavy image assets | 3 hours |
| FE-007 | LOW | React SSR hydration mismatch risk in cart | 1 hour |
| API-004 | LOW | Pagination not standardized (Memory bloat) | 2 hours |

Execution Order
1. ORM Optimization (`PERF-001`, `BE-004`, `DB-004`)
2. Cache Hygiene (`BE-005`, `RED-003`, `RED-004`)
3. DB Configuration (`PERF-002`, `PERF-003`)
4. Frontend/CDN (`PERF-005`, `PERF-004`, `FE-007`, `DB-005`, `API-004`)

Dependencies
Requires staging data volume to mirror production scale (e.g., 1M+ mock orders) to accurately test indexes.

Testing Requirements
k6 / Artillery load testing targeting the catalog and cart endpoints specifically. Monitor query execution times.

Rollback Considerations
Index additions are safe (use `CONCURRENTLY`). Cache changes might briefly elevate DB load upon rollback. 

Expected Risk Reduction
Prevents traffic-induced outages. Reduces DB CPU utilization by 80%.

=================================================
PHASE 5
=======

Objective
Establish engineering excellence, observability, automated testing, and developer operations (DevOps).

Why it matters
Without CI/CD, automated testing, and proper log aggregation, the engineering team is flying blind. Every future feature release runs the risk of re-introducing the critical bugs we just fixed in Phases 1-4. 

Issues Included
Docker security, CI/CD pipelines, Test Coverage, Logging visibility, API versioning, and missing business flows.

Table:

| ID | Severity | Reason | Estimated Effort |
| -- | -------- | ------ | ---------------- |
| DV-001 | CRITICAL | No CI/CD Pipeline (Manual deploy risk) | 1 day |
| DV-002 | CRITICAL | Docker runs as root in Builder stage | 1 hour |
| TEST-001 | CRITICAL | No unit tests for core services | 3 days |
| TEST-002 | CRITICAL | No Razorpay payment flow integration tests | 2 days |
| DV-003 | HIGH | No health check dependencies in Docker Compose | 1 hour |
| DV-004 | HIGH | No database migration strategy in deployment pipeline | 2 hours |
| DV-005 | HIGH | Docker Compose secrets in plaintext | 2 hours |
| TEST-003 | HIGH | No automated Load/Stress testing | 2 days |
| TEST-004 | HIGH | No Contract Testing between UI and API | 2 days |
| PAY-005 | HIGH | Manual refund flow missing API implementation | 1 day |
| API-001 | HIGH | No API Versioning (Breaking change risk) | 1 day |
| DV-007 | MEDIUM | No structured JSON logging / Log Aggregation | 4 hours |
| SEC-010 | MEDIUM | Admin endpoints missing Audit Logging table | 3 hours |
| SEC-011 | MEDIUM | PII and sensitive data exposed in app logs | 2 hours |
| BE-011 | MEDIUM | Abandoned Cart recovery cron job missing | 1 day |
| TEST-005 | MEDIUM | E2E tests polluting database between runs | 1 day |
| Q-003 | MEDIUM | No queue depth monitoring / alerting | 4 hours |
| API-002 | MEDIUM | Inconsistent error schemas | 4 hours |
| DV-006 | MEDIUM | Multi-stage build optimization missing | 2 hours |
| DV-008 | LOW | Frontend containerization missing | 2 hours |
| FE-005 | LOW | Accessibility/ARIA issues in checkout | 2 hours |
| FE-006 | LOW | Missing SEO Meta tags | 2 hours |
| BE-014 | LOW | console.log in production code | 1 hour |

Execution Order
1. DevOps Baseline (`DV-002`, `DV-003`, `DV-005`, `DV-004`, `DV-001`)
2. Observability (`DV-007`, `SEC-011`, `SEC-010`, `Q-003`, `BE-014`)
3. Test Coverage (`TEST-001`, `TEST-002`, `TEST-005`, `TEST-004`, `TEST-003`)
4. Architecture & Features (`API-001`, `API-002`, `PAY-005`, `BE-011`, `FE-005`, `FE-006`)

Dependencies
Requires provisioned CI/CD runners (e.g., GitHub Actions) and an observability stack (Datadog, Loki, etc.).

Testing Requirements
Triggering pipeline failures to ensure CI blocks broken PRs. 

Rollback Considerations
Pipeline updates can be reverted via git history. Non-destructive to application state.

Expected Risk Reduction
Enables safe, automated, highly visible continuous delivery.

=================================================

### 1. Master Priority Table

| Priority | ID | Phase |
| -------- | -- | ----- |
| 1 | BE-001 | Phase 1 |
| 2 | BE-002 | Phase 1 |
| 3 | PAY-003 | Phase 1 |
| 4 | SEC-001 | Phase 1 |
| 5 | SEC-003 | Phase 1 |
| 6 | PAY-002 | Phase 1 |
| 7 | Q-001 | Phase 1 |
| 8 | FE-001 | Phase 1 |
| 9 | FE-002 | Phase 1 |
| 10 | SEC-002 | Phase 2 |
| 11 | SEC-004 | Phase 2 |
| 12 | SEC-005 | Phase 2 |
| 13 | DB-001 | Phase 3 |
| 14 | RED-001 | Phase 3 |
| 15 | PERF-001 | Phase 4 |
| 16 | DV-001 | Phase 5 |
| 17 | TEST-001| Phase 5 |
| *(Remaining sorted by Phase -> Severity)* | | |

### 2. Total Engineering Effort Estimate
* **Phase 1:** ~14.5 hours (~2 days)
* **Phase 2:** ~14 hours (~2 days)
* **Phase 3:** ~18.5 hours (~2.5 days)
* **Phase 4:** ~22 hours (~3 days)
* **Phase 5:** ~18 days
* **Total Estimate:** ~27.5 Engineering Days (1 month for a single engineer, 1.5 weeks for a squad of 3).

### 3. Recommended Git Branch Strategy
* **Branching Model:** Trunk-Based Development with short-lived feature branches.
* **Format:** `fix/phase[X]-finding-[ID]` (e.g., `fix/phase1-be001-double-checkout`).
* **Environment Mapping:** `main` auto-deploys to Staging. Manual promotion gate to Production.

### 4. Recommended Commit Structure
* Enforce **Conventional Commits**.
* Scope commits to the specific audit ID to ensure traceability.
* Example: `fix(orders): [BE-001] implement advisory lock in checkout`
* Example: `perf(cart): [PERF-001] batch variant hydration to prevent N+1`

### 5. Recommended Testing Strategy Between Phases
* **Post-Phase 1:** Conduct manual "Red Team" session against checkout flows. Attempt concurrent purchases and webhook manipulation before moving to Phase 2.
* **Post-Phase 2:** Run automated vulnerability scanners (e.g., OWASP ZAP) targeting auth/session cookies and CORS logic.
* **Post-Phase 3:** Execute controlled Chaos Engineering in staging. Restart Redis and PostgreSQL while simulating moderate traffic.
* **Post-Phase 4:** Run k6 load test scripts hitting 150% of expected peak load to validate index/cache fixes.
* **Post-Phase 5:** System is fully automated. Enforce strict PR coverage gates moving forward.

### 6. STOP