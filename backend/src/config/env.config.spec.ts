import { envSchema, validateEnv } from './env.config';

const baseEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://root:root@localhost:5432/fashion_store_test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'ci_dummy_jwt_secret_that_is_at_least_32_chars',
  JWT_EXPIRES_IN: '15m',
  REFRESH_TOKEN_EXPIRES_IN_DAYS: '7',
  RAZORPAY_KEY_ID: 'mock_key_id',
  RAZORPAY_KEY_SECRET: 'mock_key_secret',
  RAZORPAY_WEBHOOK_SECRET: 'mock_webhook_secret',
  AWS_ACCESS_KEY_ID: 'mock_aws_access_key_id',
  AWS_SECRET_ACCESS_KEY: 'mock_aws_secret_access_key_32chars_long',
  AWS_REGION: 'us-east-1',
  AWS_S3_BUCKET: 'mock-bucket',
};

describe('envSchema', () => {
  it('should accept a valid test environment', () => {
    const result = envSchema.safeParse(baseEnv);
    expect(result.success).toBe(true);
  });

  it('should reject a JWT_SECRET shorter than 32 characters', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      JWT_SECRET: 'short-secret',
    });
    expect(result.success).toBe(false);
  });

  it('should default NODE_ENV to development', () => {
    const { NODE_ENV: _, ...withoutNodeEnv } = baseEnv;
    const result = envSchema.parse(withoutNodeEnv);
    expect(result.NODE_ENV).toBe('development');
  });
});

describe('validateEnv', () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  afterEach(() => {
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should return parsed env for test environment with mock secrets', () => {
    const env = validateEnv({ ...baseEnv, NODE_ENV: 'test' });
    expect(env.NODE_ENV).toBe('test');
    expect(env.JWT_SECRET).toBe(baseEnv.JWT_SECRET);
    expect(env.RAZORPAY_KEY_ID).toBe('mock_key_id');
  });

  it('should return parsed env for development environment with mock secrets', () => {
    const env = validateEnv({ ...baseEnv, NODE_ENV: 'development' });
    expect(env.NODE_ENV).toBe('development');
  });

  it('should allow test placeholder values in test/development environments', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        NODE_ENV: 'test',
        JWT_SECRET: 'test_placeholder_secret_32_chars_long_abc',
        RAZORPAY_KEY_ID: 'test_placeholder_key_id',
      }),
    ).not.toThrow();
  });

  it('should throw when schema validation fails regardless of environment', () => {
    expect(() => validateEnv({ ...baseEnv, DATABASE_URL: 'not-a-url' })).toThrow(
      'Invalid environment variables',
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should throw when JWT_SECRET is too short regardless of environment', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        JWT_SECRET: 'short-secret',
      }),
    ).toThrow('Invalid environment variables');
  });

  describe('production environment', () => {
    it('should accept strong production secrets', () => {
      const env = validateEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'a-very-strong-production-jwt-secret-32-plus',
        RAZORPAY_KEY_ID: 'rzp_live_strong_key_id_value',
        RAZORPAY_KEY_SECRET: 'strong_razorpay_key_secret_value',
        RAZORPAY_WEBHOOK_SECRET: 'strong_razorpay_webhook_secret_32_chars',
        AWS_ACCESS_KEY_ID: 'strong_aws_access_key_id_value',
        AWS_SECRET_ACCESS_KEY: 'strong_aws_secret_access_key_value_32_chars',
      });
      expect(env.NODE_ENV).toBe('production');
    });

    it('should throw when JWT_SECRET contains a mock value in production', () => {
      expect(() =>
        validateEnv({
          ...baseEnv,
          NODE_ENV: 'production',
          JWT_SECRET: 'ci_dummy_jwt_secret_that_is_at_least_32_chars',
        }),
      ).toThrow('Insecure secrets detected');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should throw when RAZORPAY_KEY_ID contains a mock value in production', () => {
      expect(() =>
        validateEnv({
          ...baseEnv,
          NODE_ENV: 'production',
          RAZORPAY_KEY_ID: 'mock_key_id',
        }),
      ).toThrow('Insecure secrets detected');
    });

    it('should throw when RAZORPAY_KEY_SECRET contains a placeholder value in production', () => {
      expect(() =>
        validateEnv({
          ...baseEnv,
          NODE_ENV: 'production',
          RAZORPAY_KEY_SECRET: 'your_razorpay_key_secret',
        }),
      ).toThrow('Insecure secrets detected');
    });

    it('should throw when RAZORPAY_WEBHOOK_SECRET contains a changeme value in production', () => {
      expect(() =>
        validateEnv({
          ...baseEnv,
          NODE_ENV: 'production',
          RAZORPAY_WEBHOOK_SECRET: 'changeme_webhook_secret_32_chars_long',
        }),
      ).toThrow('Insecure secrets detected');
    });

    it('should throw for super-secret value in production', () => {
      expect(() =>
        validateEnv({
          ...baseEnv,
          NODE_ENV: 'production',
          JWT_SECRET: 'super-secret-32-chars-long-value-abc',
        }),
      ).toThrow('Insecure secrets detected');
    });
  });

  it('should warn when FRONTEND_ORIGINS is missing', () => {
    const { FRONTEND_ORIGINS: _, ...withoutFrontendOrigins } = baseEnv as Record<string, string>;
    validateEnv(withoutFrontendOrigins);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('FRONTEND_ORIGINS is missing'),
    );
  });
});
