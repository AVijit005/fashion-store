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
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>) => {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    console.error('❌ Invalid environment variables configuration:', result.error.format());
    throw new Error('Invalid environment variables');
  }
  const env = result.data;

  // SEC-001: Enforce strong secrets in ALL environments
  const weakValues = [
    env.JWT_SECRET,
    env.RAZORPAY_KEY_ID,
    env.RAZORPAY_KEY_SECRET,
    env.RAZORPAY_WEBHOOK_SECRET,
  ];
  
  if (
    weakValues.some((value) =>
      /placeholder|mock|changeme|your_|test_placeholder|super-secret/i.test(value),
    ) ||
    env.JWT_SECRET.length < 32
  ) {
    console.error(
      'FATAL: Secrets are using placeholder or mock values, or JWT_SECRET is too short (< 32 chars). Please use secure values in your .env file.',
    );
    throw new Error('Insecure secrets detected');
  }

  if (!env.FRONTEND_ORIGINS) {
    console.warn('⚠️ WARNING: FRONTEND_ORIGINS is missing. CORS may block frontend requests.');
  }

  return env;
};
