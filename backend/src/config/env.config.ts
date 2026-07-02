import { z } from 'zod';

export const envSchema = z.object({
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN_DAYS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('7'),
  FRONTEND_ORIGINS: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().min(8),
  RAZORPAY_KEY_SECRET: z.string().min(8),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(8),
  AWS_ACCESS_KEY_ID: z.string().min(16),
  AWS_SECRET_ACCESS_KEY: z.string().min(32),
  AWS_REGION: z.string().min(2),
  AWS_S3_BUCKET: z.string().min(3),
  AWS_S3_ENDPOINT: z.string().url().optional(),
  SENTRY_DSN: z.string().optional(),
  REDIS_CLUSTER_NODES: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),

  // Phase 5 (audit item 5.1): Google OAuth credentials. Both are optional
  // — when missing the strategy is constructed with placeholder values
  // and /auth/google will throw if invoked.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),

  // Razorpay mock-mode opt-in. NEVER true in production — see env.config.ts guard.
  ALLOW_MOCK_PAYMENTS: z.enum(['true', 'false']).optional(),

  // Email (transactional — signup verification, password reset, order receipts)
  // All optional so dev environments can run without an SMTP server; the
  // EmailProcessor logs and retries when these are unset.
  EMAIL_FROM: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.enum(['true', 'false']).optional(),
  EMAIL_WORKER_DISABLED: z.enum(['true', 'false']).optional(),

  // Frontend origin used to build absolute URLs in emails (verify, reset, etc.)
  FRONTEND_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>) => {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    console.error('❌ Invalid environment variables configuration:', result.error.format());
    throw new Error('Invalid environment variables');
  }
  const env = result.data;

  // SEC-001: Enforce strong secrets in production only.
  // Development and test environments may use mock/placeholder values for CI/test runs,
  // but schema types and minimum lengths are still enforced for all environments.
  if (env.NODE_ENV === 'production') {
    // Reject anything that looks like a placeholder, demo string, or short repeated pattern.
    // The regex intentionally also catches the legacy example values
    // (a1b2c3d4…) and repeated-character strings that previously slipped past the guard.
    //
    // NOTE: We deliberately do NOT match `1234567890` as a substring — real
    // Razorpay keys commonly contain that digit run, and matching it would
    // produce false positives on legitimate live credentials.
    const WEAK_VALUE_RE =
      /placeholder|mock|changeme|your_|test_placeholder|super-secret|a1b2c3d4|^.{0,8}$|^(.)\1+$/i;

    const secretChecks: Array<{ name: string; value: string; minLength: number }> = [
      { name: 'JWT_SECRET', value: env.JWT_SECRET, minLength: 32 },
      { name: 'RAZORPAY_KEY_SECRET', value: env.RAZORPAY_KEY_SECRET, minLength: 32 },
      { name: 'RAZORPAY_WEBHOOK_SECRET', value: env.RAZORPAY_WEBHOOK_SECRET, minLength: 32 },
      { name: 'AWS_SECRET_ACCESS_KEY', value: env.AWS_SECRET_ACCESS_KEY, minLength: 32 },
      { name: 'RAZORPAY_KEY_ID', value: env.RAZORPAY_KEY_ID, minLength: 16 },
      { name: 'AWS_ACCESS_KEY_ID', value: env.AWS_ACCESS_KEY_ID, minLength: 16 },
    ];

    const failing: string[] = [];

    for (const { name, value, minLength } of secretChecks) {
      if (WEAK_VALUE_RE.test(value)) {
        failing.push(`${name} is a placeholder or weak value`);
      } else if (value.length < minLength) {
        failing.push(`${name} is too short (${value.length} < ${minLength})`);
      }
    }

    if (failing.length > 0) {
      console.error('FATAL: Insecure secrets detected in production environment:');
      for (const msg of failing) {
        console.error(`  - ${msg}`);
      }
      console.error(
        '\nGenerate strong secrets with: openssl rand -base64 64\nSee backend/.env.example for guidance.',
      );
      throw new Error('Insecure secrets detected — refusing to start');
    }

    // Phase 1 (audit item 1.8): refuse ALLOW_MOCK_PAYMENTS=true in production.
    // The mock path silently accepts "paid" orders without a real Razorpay
    // call — a missing env var in production must NOT enable free checkouts.
    if (env.ALLOW_MOCK_PAYMENTS === 'true') {
      console.error(
        'FATAL: ALLOW_MOCK_PAYMENTS=true is set. This bypasses real Razorpay calls ' +
          'and would let customers check out for free. Refusing to start in production.',
      );
      throw new Error('ALLOW_MOCK_PAYMENTS must not be true in production');
    }
  }

  if (!env.FRONTEND_ORIGINS) {
    console.warn('⚠️ WARNING: FRONTEND_ORIGINS is missing. CORS may block frontend requests.');
  }

  return env;
};
