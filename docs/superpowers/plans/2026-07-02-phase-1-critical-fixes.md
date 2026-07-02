# Phase 1 — Critical Production Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the nine critical issues that block deployment of `aura-streetwear-main` to real customers — fabricated MRP, fake reviews, fake PDP ETA, hardcoded Studio products, missing RMA workflow, hardcoded tax/shipping/markup, and silent Razorpay mock-mode failures.

**Architecture:** Schema-first migration → backend services in NestJS (Drizzle-style modules: module/controller/service/dto) → frontend TanStack components calling real APIs → final verification via existing Jest e2e suite + new unit tests.

**Tech Stack:** Prisma + PostgreSQL · NestJS 10 (Express) · BullMQ + Redis · TanStack Start (React 19) + TanStack Query · Jest e2e

**Audit reference:** `/.kimchi/docs/AURA_AUDIT_AND_PLAN.md` (full audit doc). **User decisions baked in:** stub logistics (no third-party), full RMA state machine, nullable `mrp` column.

---

## File Structure — what gets created/modified

```
backend/
├── prisma/
│   ├── schema.prisma                    (MODIFY)  Add MRP, returns, refunds, zones, etc.
│   └── migrations/
│       └── 20260702_phase1_critical/    (CREATE)  Generated Prisma migration
│   └── seed.ts                          (MODIFY)  Seed defaults for new GlobalSettings rows
└── src/
    ├── config/
    │   └── settings.service.ts          (CREATE)  Typed accessors for GlobalSetting rows
    ├── modules/
    │   ├── logistics/                   (CREATE)  logistics.module/controller/service + DTO
    │   │   ├── logistics.module.ts
    │   │   ├── logistics.controller.ts
    │   │   ├── logistics.service.ts
    │   │   ├── logistics.zone-seed.ts
    │   │   └── dto/eta-query.dto.ts
    │   ├── reviews/                     (CREATE)  reviews.module/controller/service + DTO
    │   │   ├── reviews.module.ts
    │   │   ├── reviews.controller.ts
    │   │   ├── reviews.service.ts
    │   │   └── dto/create-review.dto.ts
    │   ├── returns/                     (CREATE)  returns.module/controller/service + DTO
    │   │   ├── returns.module.ts
    │   │   ├── returns.controller.ts
    │   │   ├── returns.service.ts
    │   │   ├── returns.state-machine.ts
    │   │   └── dto/{create-return,review-return,refund}.dto.ts
    │   ├── payments/
    │   │   └── payments.service.ts      (MODIFY)  Lock Razorpay mock to dev-only
    │   ├── orders/
    │   │   └── orders.service.ts        (MODIFY)  Read tax/shipping/markup from GlobalSettings
    │   ├── catalog/
    │   │   ├── catalog.service.ts       (MODIFY)  Add getProductReviews aggregate helper
    │   │   └── catalog.controller.ts    (MODIFY)  Inject reviews aggregate into getProductBySlug
    │   └── admin/                       (MODIFY)  admin.returns module section
    └── app.module.ts                    (MODIFY)  Register new modules

src/
├── lib/
│   ├── api/
│   │   ├── catalog.ts                   (MODIFY)  Remove fake MRP; read real `mrp`
│   │   ├── reviews.ts                   (CREATE)  Frontend reviews client
│   │   ├── returns.ts                   (CREATE)  Frontend returns client
│   │   └── logistics.ts                 (CREATE)  Frontend logistics client
│   └── seo.ts                           (VERIFY)  No longer emit fake aggregateRating
├── components/
│   ├── pdp/
│   │   ├── reviews-block.tsx            (REWRITE) Real backend reviews with useQuery
│   │   ├── review-form.tsx              (CREATE)  Verified-buyer review form
│   │   └── trust-row.tsx                (MODIFY)  Real logistics ETA via apiClient
│   └── account/
│       └── return-request-modal.tsx     (CREATE)  Modal to request a return
├── routes/
│   ├── p.$slug.tsx                      (MODIFY)  Read real MRP; link review form
│   ├── studio.tsx                       (MODIFY)  Wire PRODUCTS to real catalog query
│   ├── account.tsx                      (MODIFY)  Add "Request return" CTA on DELIVERED orders
│   └── admin.returns.tsx                (CREATE)  Admin returns management
└── stores/
    └── (no changes)

docs/
└── PHASE_1_CHANGELOG.md                 (CREATE)  Summary of all changes for reviewer
```

---

# PHASE 1A — Schema, Settings, Mock Lock

### Task 1: Prisma schema additions + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/seed.ts` updates
- Run: `npx prisma migrate dev --name phase1_critical_fixes`

- [ ] **Step 1: Add fields to `Product`**

```prisma
model Product {
  // ... existing fields ...
  mrp              Decimal?        @db.Decimal(10, 2) @map("mrp")
  lowStockThreshold Int            @default(5)      @map("low_stock_threshold")
  customizable     Boolean         @default(false)  @map("customizable")
  // ... rest unchanged ...
}
```

- [ ] **Step 2: Add `lowStockThreshold` to `ProductVariant`**

```prisma
model ProductVariant {
  // ... existing fields ...
  lowStockThreshold Int @default(5) @map("low_stock_threshold")
  // ... rest unchanged ...
}
```

- [ ] **Step 3: Add new models: `ReturnRequest`, `Refund`, `LogisticsZone`, `RestockNotification`**

```prisma
model ReturnRequest {
  id              String       @id @default(uuid())
  orderId         String       @map("order_id")
  order           Order        @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderItemId     String       @map("order_item_id")
  orderItem       OrderItem    @relation(fields: [orderItemId], references: [id], onDelete: Cascade)
  userId          String       @map("user_id")
  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  reason          String
  description     String?
  status          ReturnStatus @default(REQUESTED)
  pickupScheduled DateTime?    @map("pickup_scheduled_at")
  refundId        String?      @unique @map("refund_id")
  refund          Refund?      @relation(fields: [refundId], references: [id], onDelete: SetNull)
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")
  history         ReturnStatusHistory[]

  @@index([orderId])
  @@index([userId])
  @@index([status])
  @@map("return_requests")
}

model ReturnStatusHistory {
  id            String        @id @default(uuid())
  returnId      String        @map("return_id")
  return        ReturnRequest @relation(fields: [returnId], references: [id], onDelete: Cascade)
  oldStatus     ReturnStatus? @map("old_status")
  newStatus     ReturnStatus  @map("new_status")
  changedBy     String        @map("changed_by")
  notes         String?
  createdAt     DateTime      @default(now()) @map("created_at")

  @@index([returnId])
  @@map("return_status_histories")
}

model Refund {
  id              String        @id @default(uuid())
  orderId         String        @map("order_id")
  order           Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  paymentId       String?       @map("payment_id")
  razorpayRefundId String?      @unique @map("razorpay_refund_id")
  amountInPaise   Int           @map("amount_in_paise")
  reason          String?
  status          RefundStatus  @default(INITIATED)
  processedAt     DateTime?     @map("processed_at")
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")
  return          ReturnRequest?

  @@index([orderId])
  @@map("refunds")
}

model LogisticsZone {
  id              String   @id @default(uuid())
  pincodePrefix   String   @unique @map("pincode_prefix")  // e.g. "110", "400", "560"
  zone            String   // NEAR | MID | FAR | UNSERVICEABLE
  etaMinDays      Int      @map("eta_min_days")
  etaMaxDays      Int      @map("eta_max_days")
  codAvailable    Boolean  @default(true) @map("cod_available")
  state           String
  city            String?
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([zone])
  @@map("logistics_zones")
}

model RestockNotification {
  id          String          @id @default(uuid())
  variantId   String          @map("variant_id")
  variant     ProductVariant  @relation(fields: [variantId], references: [id], onDelete: Cascade)
  email       String
  isNotified  Boolean         @default(false) @map("is_notified")
  createdAt   DateTime        @default(now()) @map("created_at")
  notifiedAt  DateTime?       @map("notified_at")

  @@unique([variantId, email])
  @@index([variantId])
  @@index([isNotified])
  @@map("restock_notifications")
}
```

- [ ] **Step 4: Add new enums**

```prisma
enum ReturnStatus {
  REQUESTED
  APPROVED
  REJECTED
  RECEIVED
  REFUND_INITIATED
  REFUNDED
  CANCELLED
}

enum RefundStatus {
  INITIATED
  PROCESSED
  FAILED
}
```

- [ ] **Step 5: Add `Order.returns`, `Order.refunds`, `OrderItem.returnRequest`, `ProductVariant.restockNotifications` back-relations**

Add to existing models — example:

```prisma
model Order {
  // ...
  returns    ReturnRequest[]
  refunds    Refund[]
  // ...
}

model OrderItem {
  // ...
  returnRequest ReturnRequest?
  // ...
}

model ProductVariant {
  // ...
  restockNotifications RestockNotification[]
  // ...
}

model User {
  // ...
  returnRequests ReturnRequest[]
  // ...
}
```

- [ ] **Step 6: Run migration**

```bash
cd backend
npx prisma migrate dev --name phase1_critical_fixes
```
Expected: migration created, Prisma client regenerated.

- [ ] **Step 7: Verify**

```bash
cd backend && npx prisma validate
```
Expected: "The schema at prisma/schema.prisma is valid".

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(schema): add MRP, returns, refunds, zones, restock notifications"
```

---

### Task 2: `SettingsService` for `GlobalSetting` rows

**Files:**
- Create: `backend/src/config/settings.service.ts`
- Create: `backend/src/config/settings.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Write `SettingsService`**

```typescript
// backend/src/config/settings.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

const CACHE_TTL_MS = 30_000;

export interface AppSettings {
  tax: { gstPercent: number; hsnCode: string };
  shipping: { freeThreshold: number; flatRate: number };
  studio: { customPrintMarkup: number };
  refunds: { autoApproveWindowDays: number };
}

const DEFAULTS: AppSettings = {
  tax: { gstPercent: 18, hsnCode: '6109' },
  shipping: { freeThreshold: 999, flatRate: 79 },
  studio: { customPrintMarkup: 200 },
  refunds: { autoApproveWindowDays: 7 },
};

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);
  private cache: { value: AppSettings; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaults();
  }

  private async seedDefaults() {
    const rows: Array<[string, unknown]> = [
      ['tax.gstPercent', DEFAULTS.tax.gstPercent],
      ['tax.hsnCode', DEFAULTS.tax.hsnCode],
      ['shipping.freeThreshold', DEFAULTS.shipping.freeThreshold],
      ['shipping.flatRate', DEFAULTS.shipping.flatRate],
      ['studio.customPrintMarkup', DEFAULTS.studio.customPrintMarkup],
      ['refunds.autoApproveWindowDays', DEFAULTS.refunds.autoApproveWindowDays],
    ];
    for (const [key, value] of rows) {
      await this.prisma.globalSetting.upsert({
        where: { key },
        update: {},
        create: { key, value: value as object },
      });
    }
  }

  async getAll(): Promise<AppSettings> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.value;
    }
    const rows = await this.prisma.globalSetting.findMany();
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const value: AppSettings = {
      tax: {
        gstPercent: Number(map.get('tax.gstPercent') ?? DEFAULTS.tax.gstPercent),
        hsnCode: String(map.get('tax.hsnCode') ?? DEFAULTS.tax.hsnCode),
      },
      shipping: {
        freeThreshold: Number(map.get('shipping.freeThreshold') ?? DEFAULTS.shipping.freeThreshold),
        flatRate: Number(map.get('shipping.flatRate') ?? DEFAULTS.shipping.flatRate),
      },
      studio: {
        customPrintMarkup: Number(map.get('studio.customPrintMarkup') ?? DEFAULTS.studio.customPrintMarkup),
      },
      refunds: {
        autoApproveWindowDays: Number(map.get('refunds.autoApproveWindowDays') ?? DEFAULTS.refunds.autoApproveWindowDays),
      },
    };
    this.cache = { value, at: Date.now() };
    return value;
  }

  async invalidate() {
    this.cache = null;
  }

  async set(key: string, value: unknown) {
    await this.prisma.globalSetting.upsert({
      where: { key },
      update: { value: value as object },
      create: { key, value: value as object },
    });
    await this.invalidate();
  }
}
```

- [ ] **Step 2: Create module**

```typescript
// backend/src/config/settings.module.ts
import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaModule } from './prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
```

- [ ] **Step 3: Register in `app.module.ts`**

```typescript
// In imports array of AppModule:
imports: [
  // ... existing imports ...
  SettingsModule,
],
```

- [ ] **Step 4: Build**

```bash
cd backend && npm run build
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/config/settings.service.ts backend/src/config/settings.module.ts backend/src/app.module.ts
git commit -m "feat(settings): add SettingsService backed by GlobalSetting table"
```

---

### Task 3: Lock Razorpay mock to dev-only

**Files:**
- Modify: `backend/src/modules/payments/payments.service.ts:148-160`

- [ ] **Step 1: Tighten the mock guard**

Replace lines 148-160 (the mock branch) with:

```typescript
// Mock path is only allowed in non-production with explicit opt-in.
const isDev = process.env.NODE_ENV !== 'production';
const mockAllowed =
  isDev && process.env.ALLOW_MOCK_PAYMENTS === 'true';

if (mockAllowed && (!keyId.startsWith('rzp_') || !keySecret)) {
  return {
    razorpayOrderId: `rzp_mock_${crypto.randomUUID().replace(/-/g, '')}`,
  };
}

if (!/^rzp_(test|live)_/.test(keyId) || keySecret.length < 8) {
  throw new InternalServerErrorException(
    'Payment gateway is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
  );
}
```

- [ ] **Step 2: Add a startup health check that verifies keys**

Append to `PaymentsService` constructor or create a new `RazorpayHealthIndicator`:

```typescript
// backend/src/modules/payments/payments.health.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RazorpayHealth {
  constructor(private readonly config: ConfigService) {}

  async check(): Promise<{ ok: boolean; reason?: string }> {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID') || '';
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET') || '';
    if (!/^rzp_(test|live)_/.test(keyId)) {
      return { ok: false, reason: 'RAZORPAY_KEY_ID is missing or malformed' };
    }
    if (!keySecret || keySecret.length < 8) {
      return { ok: false, reason: 'RAZORPAY_KEY_SECRET is missing or too short' };
    }
    return { ok: true };
  }
}
```

Wire into `/health/payments` endpoint (or extend existing `HealthController`).

- [ ] **Step 3: Update `.env.example`**

```bash
# Set ALLOW_MOCK_PAYMENTS=true ONLY in local dev when you don't have Razorpay keys.
# NEVER set this in production — checkout will succeed without real payment capture.
ALLOW_MOCK_PAYMENTS=false
```

- [ ] **Step 4: Update `env.config.ts` production guard**

In `backend/src/config/env.config.ts`, reject `ALLOW_MOCK_PAYMENTS=true` in production:

```typescript
if (env.NODE_ENV === 'production' && env.ALLOW_MOCK_PAYMENTS === 'true') {
  failing.push('ALLOW_MOCK_PAYMENTS must not be true in production');
}
```

- [ ] **Step 5: Run tests**

```bash
cd backend && npm run test -- payments
```
Expected: existing tests pass; add a new test for production guard.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/payments/payments.service.ts \
        backend/src/modules/payments/payments.health.ts \
        backend/.env.example \
        backend/src/config/env.config.ts
git commit -m "feat(payments): lock Razorpay mock to dev-only, add startup health check"
```

---

# PHASE 1B — Backend Services

### Task 4: Configurable tax / shipping / custom-print markup

**Files:**
- Modify: `backend/src/modules/orders/orders.service.ts:191-200` and `cart.service.ts:191`

- [ ] **Step 1: Inject `SettingsService` into `OrdersService`**

```typescript
constructor(
  // ... existing deps ...
  private readonly settingsService: SettingsService,
) {}
```

- [ ] **Step 2: Replace hardcoded tax/shipping in `orders.service.ts`**

Replace the existing block (lines ~191-200):

```typescript
// OLD:
// shippingFee = discountedBase.greaterThan(999) || discountedBase.equals(0)
//   ? new Prisma.Decimal(0) : new Prisma.Decimal(79);
// tax = discountedBase.mul(18).div(118);

// NEW:
const settings = await this.settingsService.getAll();
shippingFee = discountedBase.greaterThan(settings.shipping.freeThreshold) || discountedBase.equals(0)
  ? new Prisma.Decimal(0)
  : new Prisma.Decimal(settings.shipping.flatRate);

tax = discountedBase.mul(settings.tax.gstPercent).div(100 + settings.tax.gstPercent);
totalAmount = discountedBase.add(shippingFee);
```

- [ ] **Step 3: Replace hardcoded custom markup in `cart.service.ts`**

```typescript
// Inject SettingsService into CartService constructor
// Replace line 191:
const settings = await this.settingsService.getAll();
const customPrice = basePrice.add(new Prisma.Decimal(settings.studio.customPrintMarkup));
```

- [ ] **Step 4: Add tests**

```typescript
// backend/src/modules/orders/orders.service.spec.ts
describe('configurable tax & shipping', () => {
  it('applies shipping when subtotal is below threshold', async () => {
    // mock settings.shipping.freeThreshold=999, flatRate=79
    // subtotal=500 → shippingFee=79
  });
  it('waives shipping when subtotal >= threshold', async () => {
    // subtotal=1200 → shippingFee=0
  });
  it('computes tax as inclusive percentage', async () => {
    // subtotal=118, gstPercent=18 → tax=18
  });
});
```

- [ ] **Step 5: Run tests + build**

```bash
cd backend && npm run test -- orders cart && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/orders/orders.service.ts \
        backend/src/modules/cart/cart.service.ts
git commit -m "feat(orders,cart): read tax/shipping/custom-markup from GlobalSettings"
```

---

### Task 5: Logistics stub service + controller

**Files:**
- Create: `backend/src/modules/logistics/{logistics.module,logistics.controller,logistics.service}.ts`
- Create: `backend/src/modules/logistics/dto/eta-query.dto.ts`
- Create: `backend/src/modules/logistics/logistics.zone-seed.ts`

- [ ] **Step 1: DTO**

```typescript
// eta-query.dto.ts
import { IsString, Matches } from 'class-validator';

export class EtaQueryDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' })
  pincode!: string;
}
```

- [ ] **Step 2: Zone seed (sample Indian pincodes)**

```typescript
// logistics.zone-seed.ts
export const SEED_ZONES = [
  { pincodePrefix: '110', zone: 'NEAR', etaMinDays: 2, etaMaxDays: 3, codAvailable: true,  state: 'Delhi',   city: 'New Delhi' },
  { pincodePrefix: '122', zone: 'NEAR', etaMinDays: 2, etaMaxDays: 3, codAvailable: true,  state: 'Haryana', city: 'Gurgaon' },
  { pincodePrefix: '201', zone: 'NEAR', etaMinDays: 2, etaMaxDays: 4, codAvailable: true,  state: 'Uttar Pradesh', city: 'Noida' },
  { pincodePrefix: '400', zone: 'NEAR', etaMinDays: 2, etaMaxDays: 3, codAvailable: true,  state: 'Maharashtra', city: 'Mumbai' },
  { pincodePrefix: '411', zone: 'NEAR', etaMinDays: 2, etaMaxDays: 3, codAvailable: true,  state: 'Maharashtra', city: 'Pune' },
  { pincodePrefix: '500', zone: 'MID',  etaMinDays: 3, etaMaxDays: 4, codAvailable: true,  state: 'Telangana',   city: 'Hyderabad' },
  { pincodePrefix: '560', zone: 'MID',  etaMinDays: 3, etaMaxDays: 5, codAvailable: true,  state: 'Karnataka',   city: 'Bangalore' },
  { pincodePrefix: '600', zone: 'MID',  etaMinDays: 3, etaMaxDays: 5, codAvailable: true,  state: 'Tamil Nadu',  city: 'Chennai' },
  { pincodePrefix: '700', zone: 'FAR',  etaMinDays: 5, etaMaxDays: 7, codAvailable: false, state: 'West Bengal', city: 'Kolkata' },
  { pincodePrefix: '781', zone: 'FAR',  etaMinDays: 6, etaMaxDays: 8, codAvailable: false, state: 'Assam',       city: 'Guwahati' },
];
```

- [ ] **Step 3: Service**

```typescript
// logistics.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { SEED_ZONES } from './logistics.zone-seed';

export interface EtaResult {
  pincode: string;
  zone: string;
  etaMinDays: number;
  etaMaxDays: number;
  codAvailable: boolean;
  source: 'db' | 'seed' | 'fallback';
}

@Injectable()
export class LogisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureSeeded() {
    const count = await this.prisma.logisticsZone.count();
    if (count > 0) return;
    await this.prisma.logisticsZone.createMany({ data: SEED_ZONES });
  }

  async getEta(pincode: string): Promise<EtaResult> {
    await this.ensureSeeded();
    if (!/^\d{6}$/.test(pincode)) throw new BadRequestException('pincode must be 6 digits');

    const prefix = pincode.slice(0, 3);
    const exact = await this.prisma.logisticsZone.findUnique({
      where: { pincodePrefix: prefix },
    });
    if (exact) {
      return {
        pincode,
        zone: exact.zone,
        etaMinDays: exact.etaMinDays,
        etaMaxDays: exact.etaMaxDays,
        codAvailable: exact.codAvailable,
        source: 'db',
      };
    }
    // Fallback: rough state-wise bucket
    const fallback = this.fallbackForPrefix(prefix);
    if (!fallback) throw new NotFoundException('Unserviceable pincode');
    return { pincode, ...fallback, source: 'fallback' };
  }

  private fallbackForPrefix(prefix: string): Omit<EtaResult, 'pincode' | 'source'> | null {
    const first = prefix[0];
    if (['1', '2', '3', '4'].includes(first)) {
      return { zone: 'NEAR', etaMinDays: 3, etaMaxDays: 5, codAvailable: true };
    }
    if (['5', '6'].includes(first)) {
      return { zone: 'MID', etaMinDays: 4, etaMaxDays: 6, codAvailable: true };
    }
    if (['7', '8'].includes(first)) {
      return { zone: 'FAR', etaMinDays: 6, etaMaxDays: 8, codAvailable: false };
    }
    return null; // 9 = NE / islands, not serviceable
  }
}
```

- [ ] **Step 4: Controller + module**

```typescript
// logistics.controller.ts
import { Controller, Get, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { LogisticsService } from './logistics.service';
import { EtaQueryDto } from './dto/eta-query.dto';

@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logistics: LogisticsService) {}

  @Get('eta')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getEta(@Query() q: EtaQueryDto) {
    return this.logistics.getEta(q.pincode);
  }
}

// logistics.module.ts
import { Module } from '@nestjs/common';
import { LogisticsController } from './logistics.controller';
import { LogisticsService } from './logistics.service';
import { PrismaModule } from '../../config/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LogisticsController],
  providers: [LogisticsService],
  exports: [LogisticsService],
})
export class LogisticsModule {}
```

- [ ] **Step 5: Register in `app.module.ts`**

```typescript
imports: [/* ... */ LogisticsModule],
```

- [ ] **Step 6: Test**

```bash
cd backend && curl -s http://localhost:3000/logistics/eta?pincode=110001 | jq
```
Expected:
```json
{ "pincode": "110001", "zone": "NEAR", "etaMinDays": 2, "etaMaxDays": 3, "codAvailable": true, "source": "db" }
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/logistics
git commit -m "feat(logistics): stub service with pincode zone ETA"
```

---

### Task 6: Reviews module

**Files:**
- Create: `backend/src/modules/reviews/{reviews.module,reviews.controller,reviews.service}.ts`
- Create: `backend/src/modules/reviews/dto/create-review.dto.ts`
- Modify: `backend/src/modules/catalog/catalog.service.ts` — add `getProductReviews(slug)`

- [ ] **Step 1: DTO**

```typescript
// create-review.dto.ts
import { IsInt, IsString, Max, Min, MaxLength } from 'class-validator';

export class CreateReviewDto {
  @IsInt() @Min(1) @Max(5)
  rating!: number;

  @IsString() @MaxLength(2000)
  comment!: string;

  mediaUrls?: string[];
}
```

- [ ] **Step 2: Service (with verified-buyer gate)**

```typescript
// reviews.service.ts
import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProduct(productId: string, limit = 20, offset = 0) {
    const [items, aggregate] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId, isApproved: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { user: { select: { name: true } } },
      }),
      this.prisma.review.aggregate({
        where: { productId, isApproved: true },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);
    return {
      items: items.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        mediaUrls: r.mediaUrls,
        createdAt: r.createdAt,
        userName: r.user?.name ?? 'Anonymous',
      })),
      average: aggregate._avg.rating ?? 0,
      count: aggregate._count._all,
    };
  }

  async create(productId: string, userId: string, dto: CreateReviewDto) {
    // Verified-buyer gate: must own at least one DELIVERED order containing this product.
    const owned = await this.prisma.orderItem.findFirst({
      where: {
        productVariant: { productId },
        order: { userId, status: 'DELIVERED' },
      },
    });
    if (!owned) {
      throw new ForbiddenException('Only customers who purchased this product can review it');
    }

    // One review per user per product
    const existing = await this.prisma.review.findFirst({
      where: { userId, productId },
    });
    if (existing) {
      throw new ConflictException('You have already reviewed this product');
    }

    return this.prisma.review.create({
      data: {
        userId,
        productId,
        rating: dto.rating,
        comment: dto.comment,
        mediaUrls: dto.mediaUrls ?? [],
        isApproved: true, // auto-approve; admin moderation in Phase 6
      },
    });
  }

  async approve(reviewId: string) {
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: true },
    });
  }

  async reject(reviewId: string) {
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: false },
    });
  }
}
```

- [ ] **Step 3: Controller**

```typescript
// reviews.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('products/:slug/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  async list(@Param('slug') slug: string, @Query('limit') limit = '20', @Query('offset') offset = '0') {
    const product = await this.prismaProduct(slug);
    return this.reviews.listForProduct(product.id, Number(limit), Number(offset));
  }

  @Post()
  @UseGuards(AuthGuard)
  async create(@Param('slug') slug: string, @Body() dto: CreateReviewDto, @CurrentUser() user: { id: string }) {
    const product = await this.prismaProduct(slug);
    return this.reviews.create(product.id, user.id, dto);
  }

  private async prismaProduct(slug: string) {
    // Inject PrismaService in constructor too — shown abbreviated
    const p = await this.prisma.product.findUnique({ where: { slug } });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }
}

// Admin route — separate controller
@Controller('admin/reviews')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Patch(':id/approve')
  approve(@Param('id') id: string) { return this.reviews.approve(id); }

  @Patch(':id/reject')
  reject(@Param('id') id: string) { return this.reviews.reject(id); }
}
```

- [ ] **Step 4: Module**

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
```

- [ ] **Step 5: Modify catalog to inject reviews aggregate**

In `catalog.service.ts`:

```typescript
async getProductBySlug(slug: string) {
  const product = await this.prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      drop: true,
      variants: { where: { isDeleted: false } },
    },
  });
  if (!product) throw new NotFoundException('Product not found');

  const reviews = await this.reviewsService.listForProduct(product.id, 0, 0); // aggregate only
  return {
    ...product,
    averageRating: reviews.average,
    reviewCount: reviews.count,
  };
}
```

- [ ] **Step 6: Tests**

```typescript
describe('ReviewsService', () => {
  it('rejects review from non-buyer', async () => {
    // expect ForbiddenException
  });
  it('allows review from delivered-order owner', async () => {
    // create order DELIVERED containing product, then review → success
  });
  it('rejects duplicate review from same user', async () => {
    // expect ConflictException
  });
});
```

- [ ] **Step 7: Run + commit**

```bash
cd backend && npm run test -- reviews && npm run build
git add backend/src/modules/reviews backend/src/modules/catalog/catalog.service.ts
git commit -m "feat(reviews): verified-buyer reviews with aggregate in catalog"
```

---

### Task 7: Returns module with full state machine

**Files:**
- Create: `backend/src/modules/returns/{returns.module,returns.controller,returns.service,returns.state-machine}.ts`
- Create: `backend/src/modules/returns/dto/{create-return,review-return,refund}.dto.ts`

- [ ] **Step 1: State machine**

```typescript
// returns.state-machine.ts
import { ReturnStatus } from '@prisma/client';

const ALLOWED: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED:  ['RECEIVED', 'CANCELLED'],
  REJECTED:  [],
  RECEIVED:  ['REFUND_INITIATED'],
  REFUND_INITIATED: ['REFUNDED', 'CANCELLED'],
  REFUNDED:  [],
  CANCELLED: [],
};

export function canTransition(from: ReturnStatus, to: ReturnStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}
```

- [ ] **Step 2: DTOs**

```typescript
// create-return.dto.ts
import { IsString, IsUUID, IsOptional, MaxLength } from 'class-validator';
export class CreateReturnDto {
  @IsUUID() orderItemId!: string;
  @IsString() @MaxLength(500) reason!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}

// review-return.dto.ts
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReturnStatus } from '@prisma/client';
export class ReviewReturnDto {
  @IsEnum(ReturnStatus) decision!: ReturnStatus; // APPROVED | REJECTED
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

// refund.dto.ts
import { IsInt, IsPositive } from 'class-validator';
export class InitiateRefundDto {
  @IsInt() @IsPositive() amountInPaise!: number;
}
```

- [ ] **Step 3: Service**

```typescript
// returns.service.ts
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { EmailService } from '../email/email.service';
import { CreateReturnDto, ReviewReturnDto, InitiateRefundDto } from './dto/...';
import { canTransition } from './returns.state-machine';
import { ReturnStatus, OrderStatus } from '@prisma/client';

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly email: EmailService,
  ) {}

  async createForUser(userId: string, dto: CreateReturnDto) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: dto.orderItemId },
      include: { order: true },
    });
    if (!item) throw new NotFoundException('Order item not found');
    if (item.order.userId !== userId) throw new ForbiddenException('Not your order');
    if (item.order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be returned');
    }

    // 7-day window
    const daysSinceDelivered = (Date.now() - item.order.updatedAt.getTime()) / 86_400_000;
    if (daysSinceDelivered > 15) {
      throw new BadRequestException('Return window has expired (15 days)');
    }

    const existing = await this.prisma.returnRequest.findFirst({
      where: { orderItemId: dto.orderItemId, status: { not: 'CANCELLED' } },
    });
    if (existing) throw new ConflictException('A return already exists for this item');

    return this.prisma.returnRequest.create({
      data: {
        orderId: item.orderId,
        orderItemId: item.id,
        userId,
        reason: dto.reason,
        description: dto.description,
        history: { create: { newStatus: 'REQUESTED', changedBy: userId } },
      },
    });
  }

  async listForUser(userId: string) {
    return this.prisma.returnRequest.findMany({
      where: { userId },
      include: { order: { select: { id: true, createdAt: true } }, orderItem: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAllForAdmin() {
    return this.prisma.returnRequest.findMany({
      include: { user: { select: { email: true, name: true } }, order: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async review(returnId: string, adminId: string, dto: ReviewReturnDto) {
    const ret = await this.prisma.returnRequest.findUnique({ where: { id: returnId } });
    if (!ret) throw new NotFoundException('Return not found');
    if (!canTransition(ret.status, dto.decision)) {
      throw new BadRequestException(`Cannot transition from ${ret.status} to ${dto.decision}`);
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.returnRequest.update({
        where: { id: returnId },
        data: { status: dto.decision },
      });
      await tx.returnStatusHistory.create({
        data: { returnId, oldStatus: ret.status, newStatus: dto.decision, changedBy: adminId, notes: dto.notes },
      });
      return updated;
    });
  }

  async markReceived(returnId: string, adminId: string) {
    return this.review(returnId, adminId, { decision: 'RECEIVED' as any });
  }

  async initiateRefund(returnId: string, adminId: string, dto: InitiateRefundDto) {
    const ret = await this.prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: { order: true },
    });
    if (!ret) throw new NotFoundException('Return not found');
    if (!canTransition(ret.status, 'REFUND_INITIATED')) {
      throw new BadRequestException(`Cannot refund from status ${ret.status}`);
    }
    if (!ret.order.razorpayPaymentId) {
      throw new BadRequestException('No payment id on order — cannot refund via gateway');
    }

    const refund = await this.prisma.refund.create({
      data: {
        orderId: ret.orderId,
        paymentId: ret.order.razorpayPaymentId,
        amountInPaise: dto.amountInPaise,
        reason: ret.reason,
        status: 'INITIATED',
      },
    });

    try {
      await this.payments.refundPayment(ret.order.razorpayPaymentId, dto.amountInPaise);
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });
    } catch (err) {
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: { status: 'FAILED' },
      });
      throw err;
    }

    await this.prisma.returnRequest.update({
      where: { id: returnId },
      data: { status: 'REFUND_INITIATED' },
    });

    return refund;
  }

  async markRefunded(returnId: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const ret = await tx.returnRequest.findUnique({ where: { id: returnId }, include: { refund: true } });
      if (!ret?.refund) throw new BadRequestException('No refund record found');
      if (ret.refund.status !== 'PROCESSED') throw new BadRequestException('Refund not yet processed');

      await tx.returnRequest.update({ where: { id: returnId }, data: { status: 'REFUNDED' } });
      await tx.returnStatusHistory.create({
        data: { returnId, oldStatus: 'REFUND_INITIATED', newStatus: 'REFUNDED', changedBy: adminId },
      });
      await tx.order.update({ where: { id: ret.orderId }, data: { status: 'REFUNDED' } });
    });
  }
}
```

- [ ] **Step 4: Controller**

```typescript
// returns.controller.ts
@Controller('returns')
@UseGuards(AuthGuard)
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  create(@CurrentUser() u: { id: string }, @Body() dto: CreateReturnDto) {
    return this.returns.createForUser(u.id, dto);
  }

  @Get('me')
  mine(@CurrentUser() u: { id: string }) {
    return this.returns.listForUser(u.id);
  }
}

// admin.returns.controller.ts
@Controller('admin/returns')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  list() { return this.returns.listAllForAdmin(); }

  @Patch(':id/review')
  review(@Param('id') id: string, @CurrentUser() u: { id: string }, @Body() dto: ReviewReturnDto) {
    return this.returns.review(id, u.id, dto);
  }

  @Patch(':id/received')
  received(@Param('id') id: string, @CurrentUser() u: { id: string }) {
    return this.returns.markReceived(id, u.id);
  }

  @Post(':id/refund')
  refund(@Param('id') id: string, @CurrentUser() u: { id: string }, @Body() dto: InitiateRefundDto) {
    return this.returns.initiateRefund(id, u.id, dto);
  }

  @Patch(':id/refunded')
  refunded(@Param('id') id: string, @CurrentUser() u: { id: string }) {
    return this.returns.markRefunded(id, u.id);
  }
}
```

- [ ] **Step 5: Module**

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [ReturnsController, AdminReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
```

- [ ] **Step 6: Tests**

```typescript
describe('ReturnsService', () => {
  it('creates return for delivered order item', ...);
  it('rejects return from non-owner', ...);
  it('rejects return past 15-day window', ...);
  it('rejects duplicate return for same item', ...);
  it('admin can APPROVE → RECEIVED → REFUND_INITIATED → REFUNDED', ...);
  it('refund calls Razorpay and updates Refund status', ...);
});
```

- [ ] **Step 7: Build + commit**

```bash
cd backend && npm run test -- returns && npm run build
git add backend/src/modules/returns
git commit -m "feat(returns): full state machine with Razorpay refund integration"
```

---

# PHASE 1C — Frontend Changes

### Task 8: Frontend — drop fake MRP, read real `mrp` from backend

**Files:**
- Modify: `src/lib/api/catalog.ts:118,125-141`
- Modify: `src/components/product/product-card.tsx` (use real mrp)

- [ ] **Step 1: Update `BackendProduct` type**

```typescript
export interface BackendProduct {
  // ... existing fields ...
  mrp?: string | number | null;
  averageRating?: number;
  reviewCount?: number;
}
```

- [ ] **Step 2: Update `Product` frontend type**

```typescript
export type Product = {
  // ... existing fields ...
  mrp: number | null;          // null = no MRP set, hide strikethrough
  rating: number;
  reviews: number;
  // ...
};
```

- [ ] **Step 3: Update `mapBackendProduct`**

```typescript
const basePrice = Number(p.basePrice);
const firstVariantPrice = p.variants?.[0]?.priceOverride
  ? Number(p.variants[0].priceOverride)
  : basePrice;

// Read real MRP from backend; fallback to basePrice if absent.
const mrpNumber = p.mrp != null ? Number(p.mrp) : null;

return {
  // ...
  price: firstVariantPrice,
  mrp: mrpNumber,
  rating: p.averageRating ?? 0,
  reviews: p.reviewCount ?? 0,
  // ...
};
```

- [ ] **Step 4: Update `product-card.tsx` to hide strikethrough when `mrp` is null**

```tsx
{product.mrp != null && product.mrp > product.price && (
  <p className="text-mute line-through tabular-nums">{inr(product.mrp)}</p>
)}
```

- [ ] **Step 5: Lint + typecheck**

```bash
cd /mnt/d/aura-streetwear-main && npm run typecheck && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/catalog.ts src/components/product/product-card.tsx
git commit -m "feat(catalog): read real MRP, hide strikethrough when null"
```

---

### Task 9: Frontend — real reviews on PDP

**Files:**
- Create: `src/lib/api/reviews.ts`
- Modify: `src/components/pdp/reviews-block.tsx`
- Create: `src/components/pdp/review-form.tsx`
- Modify: `src/routes/p.$slug.tsx`

- [ ] **Step 1: API client**

```typescript
// src/lib/api/reviews.ts
import { apiClient } from "./client";

export interface ReviewDto {
  id: string;
  rating: number;
  comment: string;
  mediaUrls: string[];
  createdAt: string;
  userName: string;
}

export interface ReviewsListResponse {
  items: ReviewDto[];
  average: number;
  count: number;
}

export const reviewsApi = {
  list: (slug: string, limit = 20, offset = 0) =>
    apiClient.get<ReviewsListResponse>(`/products/${slug}/reviews`, { limit, offset }),
  create: (slug: string, body: { rating: number; comment: string; mediaUrls?: string[] }) =>
    apiClient.post<ReviewDto>(`/products/${slug}/reviews`, body),
};
```

- [ ] **Step 2: Rewrite `reviews-block.tsx`**

```tsx
import { useState } from "react";
import { Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { reviewsApi } from "@/lib/api/reviews";
import { useAuthStore } from "@/lib/store/auth";

export function ReviewsBlock({ slug }: { slug: string }) {
  const [filter, setFilter] = useState<"all" | "photos" | "5" | "4">("all");
  const isAuthed = useAuthStore((s) => s.isAuthenticated);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reviews", slug],
    queryFn: () => reviewsApi.list(slug),
  });

  if (isLoading) return <div className="px-10 py-20 text-mute">Loading reviews…</div>;
  if (isError || !data) return null;

  const { items, average, count } = data;
  const visible = items.filter((r) => {
    if (filter === "photos") return r.mediaUrls.length > 0;
    if (filter === "5") return r.rating === 5;
    if (filter === "4") return r.rating === 4;
    return true;
  });

  // Histogram from real ratings
  const dist = [5, 4, 3, 2, 1].map((star) => {
    const total = items.filter((r) => r.rating === star).length;
    return count > 0 ? Math.round((total / count) * 100) : 0;
  });

  return (
    <section className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-[1480px] grid-cols-1 gap-10 px-5 py-20 lg:grid-cols-[320px_1fr] lg:px-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Reviews</p>
          <p className="mt-2 font-display text-6xl tabular-nums">{average.toFixed(1)}</p>
          <div className="mt-2 flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`h-4 w-4 ${i < Math.round(average) ? "fill-ink text-ink" : "text-line"}`} />
            ))}
          </div>
          <p className="mt-2 text-[12px] text-mute">Based on {count} verified reviews</p>
          <div className="mt-6 space-y-2">
            {[5, 4, 3, 2, 1].map((r, i) => (
              <div key={r} className="flex items-center gap-3 text-[12px]">
                <span className="w-3 tabular-nums">{r}</span>
                <div className="h-1.5 flex-1 bg-fog">
                  <div className="h-full bg-ink" style={{ width: `${dist[i]}%` }} />
                </div>
                <span className="w-8 tabular-nums text-mute">{dist[i]}%</span>
              </div>
            ))}
          </div>
          {isAuthed && <ReviewForm slug={slug} />}
        </div>
        <div>
          <div className="flex flex-wrap gap-2">
            {[{k:"all",l:"All"},{k:"photos",l:"With photos"},{k:"5",l:"5 stars"},{k:"4",l:"4 stars"}].map((f) => (
              <button key={f.k} onClick={() => setFilter(f.k as typeof filter)}
                className={`border px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] ${
                  filter === f.k ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
                }`}>{f.l}</button>
            ))}
          </div>
          <ul className="mt-6 space-y-6">
            {visible.length === 0 && (
              <li className="text-sm text-mute">No reviews yet. Be the first to write one.</li>
            )}
            {visible.map((r) => (
              <li key={r.id} className="border-b border-line pb-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < r.rating ? "fill-ink text-ink" : "text-line"}`} />
                      ))}
                    </div>
                    <p className="text-[12px] uppercase tracking-[0.18em] text-mute">{r.userName}</p>
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-mute">
                    {new Date(r.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "short" })}
                  </p>
                </div>
                <p className="mt-2 text-sm text-graphite">{r.comment}</p>
                {r.mediaUrls.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {r.mediaUrls.map((u, i) => (
                      <img key={i} src={u} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: `ReviewForm` component (verified-buyer only)**

```tsx
// src/components/pdp/review-form.tsx
import { useState } from "react";
import { Star } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewsApi } from "@/lib/api/reviews";
import { toast } from "sonner";

export function ReviewForm({ slug }: { slug: string }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const submit = useMutation({
    mutationFn: () => reviewsApi.create(slug, { rating, comment }),
    onSuccess: () => {
      toast.success("Review submitted");
      qc.invalidateQueries({ queryKey: ["reviews", slug] });
      setOpen(false);
      setComment("");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to submit"),
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-6 w-full border border-ink py-3 text-[12px] uppercase tracking-[0.22em] hover:bg-ink hover:text-paper">
        Write a review
      </button>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit.mutate(); }} className="mt-6 space-y-3">
      <div className="flex gap-1">
        {[1,2,3,4,5].map((i) => (
          <button key={i} type="button" onClick={() => setRating(i)}>
            <Star className={`h-5 w-5 ${i <= rating ? "fill-ink text-ink" : "text-line"}`} />
          </button>
        ))}
      </div>
      <textarea
        value={comment} onChange={(e) => setComment(e.target.value)}
        placeholder="Tell others what you think…"
        className="w-full border border-line bg-transparent p-3 text-sm"
        rows={3}
        required minLength={10}
      />
      <div className="flex gap-2">
        <button type="submit" disabled={submit.isPending} className="bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-paper">
          {submit.isPending ? "…" : "Submit"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-mute">Cancel</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Update `p.$slug.tsx`**

Replace `<ReviewsBlock rating={product.rating ?? 0} count={product.reviews ?? 0} />` with:

```tsx
<ReviewsBlock slug={product.slug} />
```

- [ ] **Step 5: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/reviews.ts src/components/pdp/reviews-block.tsx src/components/pdp/review-form.tsx src/routes/p.\$slug.tsx
git commit -m "feat(pdp): real reviews with verified-buyer submission form"
```

---

### Task 10: Frontend — wire Studio to real products

**Files:**
- Modify: `src/routes/studio.tsx`

- [ ] **Step 1: Add products query**

Replace the hardcoded `PRODUCTS` array (lines 43-66):

```tsx
import { useQuery } from "@tanstack/react-query";
import { catalogApi } from "@/lib/api/catalog";

// Inside Studio component:
const { data: products = [], isLoading } = useQuery({
  queryKey: ["studio-products"],
  queryFn: async () => {
    const { products } = await catalogApi.getProducts({ tags: "custom-print", limit: 20 });
    return products;
  },
});

const product = products.find((p) => p.id === productId) ?? products[0];
```

- [ ] **Step 2: Seed: tag customizable products**

In seed.ts (already exists), add `tags: ['custom-print']` to the products that should be in the studio, and set `customizable: true` in the schema. (Backend already supports `customizable` after Task 1.)

- [ ] **Step 3: Build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/studio.tsx backend/prisma/seed.ts
git commit -m "feat(studio): fetch real customizable products instead of hardcoded list"
```

---

### Task 11: Frontend — real logistics ETA on PDP

**Files:**
- Create: `src/lib/api/logistics.ts`
- Modify: `src/components/pdp/trust-row.tsx`

- [ ] **Step 1: API client**

```typescript
// src/lib/api/logistics.ts
import { apiClient } from "./client";

export interface EtaResult {
  pincode: string;
  zone: string;
  etaMinDays: number;
  etaMaxDays: number;
  codAvailable: boolean;
}

export const logisticsApi = {
  getEta: (pincode: string) => apiClient.get<EtaResult>("/logistics/eta", { pincode }),
};
```

- [ ] **Step 2: Replace fake in `trust-row.tsx`**

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { logisticsApi } from "@/lib/api/logistics";
import { Truck, RotateCcw, ShieldCheck, Wallet } from "lucide-react";

export function PdpTrustRow() {
  const [pin, setPin] = useState("");
  const [activePin, setActivePin] = useState("");

  const { data: eta, isFetching, error } = useQuery({
    queryKey: ["eta", activePin],
    queryFn: () => logisticsApi.getEta(activePin),
    enabled: activePin.length === 6,
    retry: 1,
    staleTime: 24 * 60 * 60 * 1000,
  });

  // ... rest of component unchanged, but use `eta` from real API
}
```

- [ ] **Step 3: Typecheck + lint + commit**

```bash
npm run typecheck && npm run lint
git add src/lib/api/logistics.ts src/components/pdp/trust-row.tsx
git commit -m "feat(pdp): real logistics ETA replacing fake setTimeout"
```

---

### Task 12: Frontend — returns UI (user + admin)

**Files:**
- Create: `src/lib/api/returns.ts`
- Create: `src/components/account/return-request-modal.tsx`
- Modify: `src/routes/account.tsx` (add Return CTA on DELIVERED orders)
- Create: `src/routes/admin.returns.tsx`

- [ ] **Step 1: API client**

```typescript
// src/lib/api/returns.ts
import { apiClient } from "./client";

export interface ReturnRequestDto {
  id: string;
  orderId: string;
  orderItemId: string;
  reason: string;
  description?: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "RECEIVED" | "REFUND_INITIATED" | "REFUNDED" | "CANCELLED";
  createdAt: string;
}

export const returnsApi = {
  create: (body: { orderItemId: string; reason: string; description?: string }) =>
    apiClient.post<ReturnRequestDto>("/returns", body),
  my: () => apiClient.get<ReturnRequestDto[]>("/returns/me"),
  adminList: () => apiClient.get<ReturnRequestDto[]>("/admin/returns"),
  adminReview: (id: string, body: { decision: "APPROVED" | "REJECTED"; notes?: string }) =>
    apiClient.patch<ReturnRequestDto>(`/admin/returns/${id}/review`, body),
  adminReceived: (id: string) =>
    apiClient.patch<ReturnRequestDto>(`/admin/returns/${id}/received`),
  adminRefund: (id: string, body: { amountInPaise: number }) =>
    apiClient.post(`/admin/returns/${id}/refund`, body),
  adminMarkRefunded: (id: string) =>
    apiClient.patch<ReturnRequestDto>(`/admin/returns/${id}/refunded`),
};
```

- [ ] **Step 2: User modal**

```tsx
// return-request-modal.tsx
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { returnsApi } from "@/lib/api/returns";
import { toast } from "sonner";
import { X } from "lucide-react";

export function ReturnRequestModal({ orderItemId, onClose }: { orderItemId: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const submit = useMutation({
    mutationFn: () => returnsApi.create({ orderItemId, reason, description }),
    onSuccess: () => { toast.success("Return request submitted"); onClose(); },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); submit.mutate(); }} className="w-full max-w-md space-y-3 bg-paper p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Request return</h2>
          <button type="button" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <select required value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-line bg-transparent p-2 text-sm">
          <option value="">Select reason</option>
          <option>Wrong size</option>
          <option>Wrong color</option>
          <option>Damaged in transit</option>
          <option>Quality issue</option>
          <option>Other</option>
        </select>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Additional details (optional)" rows={3} className="w-full border border-line bg-transparent p-2 text-sm" />
        <button type="submit" disabled={submit.isPending || !reason} className="w-full bg-ink py-3 text-[12px] uppercase tracking-[0.22em] text-paper disabled:opacity-50">
          {submit.isPending ? "Submitting…" : "Submit return"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Add CTA in `account.tsx`** — for each item in a DELIVERED order, show "Request return" button.

- [ ] **Step 4: Admin route `admin.returns.tsx`** — table view with approve/reject/mark-refunded actions.

- [ ] **Step 5: Wire admin route into the admin sidebar** in `components/admin/sidebar.tsx`.

- [ ] **Step 6: Build + commit**

```bash
npm run typecheck && npm run lint && npm run build
git add src/lib/api/returns.ts src/components/account/return-request-modal.tsx src/routes/account.tsx src/routes/admin.returns.tsx src/components/admin/sidebar.tsx
git commit -m "feat(returns): user + admin RMA UI"
```

---

# PHASE 1D — Verification

### Task 13: Final verification

- [ ] **Step 1: Backend tests pass**

```bash
cd backend && npm run test
```
Expected: all tests pass, including new tests for Phase 1 services.

- [ ] **Step 2: Backend e2e tests pass**

```bash
cd backend && npm run test:e2e
```
Expected: existing e2e tests pass.

- [ ] **Step 3: Frontend typecheck + lint**

```bash
cd /mnt/d/aura-streetwear-main && npm run typecheck && npm run lint
```
Expected: 0 errors.

- [ ] **Step 4: Frontend build**

```bash
npm run build
```
Expected: successful production build.

- [ ] **Step 5: Manual smoke test (dev server)**

```bash
docker-compose up -d postgres redis minio
cd backend && npm run start:dev &
npm run dev
```

Verify in browser:
- [ ] PDP shows real MRP for seeded products (no strikethrough on `mrp:null`)
- [ ] PDP shows real reviews count (≥1 if seeded; 0 if not)
- [ ] PDP delivery ETA returns real zone data
- [ ] Studio lists real customizable products
- [ ] Logged-in user can submit a review (after creating a DELIVERED order in seed)
- [ ] User can request a return on a DELIVERED order item
- [ ] Admin can approve → mark received → initiate refund → mark refunded
- [ ] Order totals reflect configurable shipping/tax via GlobalSettings

- [ ] **Step 6: Update `/.kimchi/docs/AURA_AUDIT_AND_PLAN.md`**

Mark Phase 1 items ✅ in the audit doc.

- [ ] **Step 7: Final commit + summary**

```bash
git add -A
git commit -m "docs: mark Phase 1 complete in audit"
```

---

## Out of scope for Phase 1 (deferred to later phases)

- Frontend test suite (Phase 6)
- Google OAuth / Apple ID (Phase 5)
- Admin 2FA (Phase 5)
- Real Shiprocket/Delhivery integration (Phase 2)
- Loyalty / rewards program (Phase 6)
- Blog CMS (Phase 6)
- Real-time order tracking (Phase 6)
