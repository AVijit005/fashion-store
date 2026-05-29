import { z } from 'zod';

export const envSchema = z.object({
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN_DAYS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('7'),
  FRONTEND_ORIGINS: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().min(8),
  RAZORPAY_KEY_SECRET: z.string().min(8),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(8),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_REGION: z.string(),
  AWS_S3_BUCKET: z.string(),
  AWS_S3_ENDPOINT: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>) => {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    console.error('❌ Invalid environment variables configuration:', result.error.format());
    throw new Error('Invalid environment variables');
  }
  const env = result.data;
  if (env.NODE_ENV === 'production') {
    const weakValues = [
      env.JWT_SECRET,
      env.RAZORPAY_KEY_ID,
      env.RAZORPAY_KEY_SECRET,
      env.RAZORPAY_WEBHOOK_SECRET,
    ];
    if (
      weakValues.some((value) => /placeholder|mock|changeme|your_|test_placeholder/i.test(value))
    ) {
      throw new Error('Production secrets must not use placeholder or mock values');
    }
    if (!env.FRONTEND_ORIGINS) {
      throw new Error('FRONTEND_ORIGINS is required in production');
    }
  }
  return env;
};
