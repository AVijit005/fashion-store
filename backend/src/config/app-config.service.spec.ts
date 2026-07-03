import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import { Env } from './env.config';

describe('AppConfigService', () => {
  let service: AppConfigService;
  let configService: jest.Mocked<ConfigService<Env>>;

  const createService = (env: Partial<Env>) => {
    configService = {
      get: jest.fn((key: keyof Env, defaultValue?: unknown) => {
        const value = env[key];
        return value !== undefined ? value : defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService<Env>>;

    return new AppConfigService(configService);
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: keyof Env, defaultValue?: unknown) => {
              const values: Partial<Env> = {
                NODE_ENV: 'test',
                PORT: 3000,
                DATABASE_URL: 'postgresql://localhost/test',
                REDIS_URL: 'redis://localhost:6379',
                JWT_SECRET: 'test_jwt_secret_that_is_at_least_32_chars_long',
                AWS_ACCESS_KEY_ID: 'test_aws_access_key_id_',
                AWS_SECRET_ACCESS_KEY: 'test_aws_secret_access_key_32chars_long',
                RAZORPAY_KEY_ID: 'test_key',
                RAZORPAY_KEY_SECRET: 'test_secret',
                RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
              };
              const value = values[key];
              return value !== undefined ? value : defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AppConfigService>(AppConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns typed values via get', () => {
    expect(service.get('NODE_ENV')).toBe('test');
    expect(service.get('PORT')).toBe(3000);
  });

  it('getOrThrow returns value when present', () => {
    expect(service.databaseUrl).toBe('postgresql://localhost/test');
  });

  it('getOrThrow throws when value is missing', () => {
    const emptyService = createService({});
    expect(() => emptyService.databaseUrl).toThrow(
      'Missing required configuration value: DATABASE_URL',
    );
  });

  it('exposes nodeEnv helpers', () => {
    expect(service.nodeEnv).toBe('test');
    expect(service.isTest).toBe(true);
    expect(service.isProduction).toBe(false);
    expect(service.isDevelopment).toBe(false);
  });

  it('provides defaults for optional values', () => {
    expect(service.port).toBe(3000);
    expect(service.jwtExpiresIn).toBe('15m');
    expect(service.refreshTokenExpiresInDays).toBe(7);
    expect(service.awsRegion).toBe('us-east-1');
    expect(service.awsS3Bucket).toBe('aura-studio');
  });
});
