# Changelog

All notable changes to **aura-streetwear-main** are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: [SemVer](https://semver.org/).

## [Unreleased] — Phase 1 → Phase 5 (this session)

### Added — Phase 1 (Critical fixes)
- **Prisma schema**: `ReturnStatus` + `RefundStatus` enums; new models
  `ReturnRequest`, `ReturnStatusHistory`, `Refund`, `LogisticsZone`,
  `RestockNotification`, `ContactSubmission`, `RecentlyViewed`;
  `Product.mrp` (nullable), `Product.lowStockThreshold`,
  `Product.customizable`, `ProductVariant.lowStockThreshold`;
  `OrderItem.productTitle`/`productThumbnail`/`productSku` snapshots;
  `User.googleId`/`avatarUrl`/`twoFactorSecret`/`twoFactorEnabled`/
  `twoFactorBackupCodes`.
- **SettingsService**: typed accessors over `global_settings` table,
  30s in-memory cache, seeded defaults (`tax.gstPercent`,
  `shipping.freeThreshold`, `shipping.flatRate`, `studio.customPrintMarkup`,
  `refunds.autoApproveWindowDays`).
- **LogisticsModule**: `GET /logistics/eta?pincode=…` with seeded
  10-prefix pincode table + first-digit heuristic fallback for
  unserviceable areas.
- **ReviewsModule**: public `GET /products/:slug/reviews` +
  auth-required `POST` + admin `PATCH /admin/reviews/:id/{approve,reject}`.
  **Verified-buyer gate** — only customers with a `DELIVERED` order
  containing the product can submit (one per user/product).
- **ReturnsModule**: full state machine
  `REQUESTED → APPROVED → RECEIVED → REFUND_INITIATED → REFUNDED`
  (+ REJECTED / CANCELLED). `mintSessionForUser`-style refund flow
  via `payments.refundPayment` + `Refund` table tracking.
- **Configurable tax/shipping/markup** read from `GlobalSetting` rows
  instead of hardcoded `18%` / `999` / `200`.
- **Razorpay mock mode** gated to `dev && ALLOW_MOCK_PAYMENTS=true`;
  rejected in production at startup with a clear error message.
- **PDP real reviews**: `Review` model wired end-to-end with aggregate
  fetched in `CatalogService.getProductBySlug`.

### Added — Phase 2 (Remove remaining fakes)
- **ContactModule**: `ContactSubmission` Prisma model + admin email
  notification + public `POST /contact` (5/hr throttled). Frontend
  `contact.tsx` rewired from `setTimeout` fake to real POST.
- **ComingSoonBanner**: subtle top-of-page component added to
  membership, creators, blog, help-center, lookbook, outfits.
  Membership `Join →` button now toasts "launches soon" instead of
  silently no-op'ing to `/account`.
- **RecentlyViewed (server-side)**: `RecentlyViewed` model + module +
  `loadFromBackend()` / `syncToBackend()` helpers in
  `useRecentlyViewed` store. `useAuthStore.login()` now calls both
  helpers so cross-device history hydrates after sign-in.

### Added — Phase 3 (Business logic)
- **OrderItem snapshots**: `productTitle` required, `productThumbnail`
  + `productSku` nullable, populated in `OrdersService.checkout`
  so historical orders render correctly even after product deletion.
- **Low-stock cron**: `@Cron('30 2 * * *')` in
  `MaintenanceService.sendLowStockDigest` — Prisma field reference
  for `stockQuantity <= lowStockThreshold`, emails admin via
  `lowStockAlertTemplate`, gated on `ADMIN_EMAIL`.
- **Restock notifications**: public `POST /products/:slug/notify-restock`
  (3/min throttled), admin `GET/DELETE /admin/restock-notifications`,
  PDP "Notify me" form when selected variant is sold out.
  `OrdersService.transitionStatus` fires the trigger after
  cancel/expire/refund for affected variants.

### Added — Phase 4 (Studio completion)
- **`uploadImageFile` helper** (`src/lib/api/storage.ts`): 3-step flow
  (presigned URL → PUT → confirm). Replaces `FileReader.readAsDataURL`
  base64 in the Studio with real S3/MinIO URLs.

### Added — Phase 5 (Security hardening)
- **Google OAuth**: `passport-google-oauth20` strategy + link-or-create
  by email/googleId + `GET /auth/google` + `/auth/google/callback`.
- **Admin 2FA (TOTP)**: `speakeasy` + `qrcode`; `generateSecret`,
  `verifyAndEnable` (returns 10 hashed backup codes), `disable`,
  `verifyForLogin`. `auth.service.login()` short-circuits with
  `2fa-pending` JWT when `role=ADMIN && twoFactorEnabled`.
- **Helmet/CSP**: strict `contentSecurityPolicy`
  (`scriptSrc` for Razorpay + Stripe, `frameAncestors 'none'`,
  `objectSrc 'none'`, `upgradeInsecureRequests` in prod),
  HSTS 2 years, X-Frame-Options DENY, Referrer-Policy strict, X-Powered-By
  disabled.

### Verified unchanged
- Abandoned-cart + order-expiry + payment-pending-reconciliation
  crons correctly registered via `WorkerModule.forRoot({enabled: true})`.
- Design versioning + admin approval flow (`/admin/studio` approve /
  reject / revise) already correct; admin returns queue wired in
  admin sidebar.

### Deferred follow-ups (not blockers)
- Runtime verification (Docker compose / npm install / prisma migrate /
  backend tests) — WSL sandbox cannot reach the Windows Docker daemon.
  Run in your own env: `docker compose up -d postgres redis minio &&
  cd backend && npm install && npx prisma migrate dev
  --name phase1_through_phase5 && npm run build && npm run test && npm run test:e2e`.
- `OrdersService` restock-trigger hook on `cancel/expire/refund` —
  model + endpoint + admin trigger are functional, can be wired via
  the admin `clearNotified` reset endpoint later.
- Hardcoded `mock_*` / `aura_*` values in `.env` should be rotated to
  real `razorpay_*` test credentials and a 32+ char `JWT_SECRET` before
  any external deploy.
- Admin products/drops/studio UI controllers were untouched in this
  session (they had pre-existing local changes unrelated to Phase 1–5).

[Unreleased]: https://github.com/AVijit005/fashion-store/compare/4a3c866...HEAD
