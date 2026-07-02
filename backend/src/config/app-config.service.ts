import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from './env.config';

/**
 * Centralized, typed application configuration service.
 *
 * Wraps NestJS ConfigService with the validated Env schema so that runtime
 * modules never need to read environment variables directly.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<Env>) {}

  get<K extends keyof Env>(key: K): Env[K] | undefined {
    return this.configService.get<Env[K]>(key);
  }

  getOrThrow<K extends keyof Env>(key: K): Env[K] {
    const value = this.configService.get<Env[K]>(key);
    if (value === undefined || value === null) {
      throw new Error(`Missing required configuration value: ${key}`);
    }
    return value;
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.configService.get('NODE_ENV', 'development') as Env['NODE_ENV'];
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  get port(): number {
    return this.configService.get('PORT', 3000);
  }

  get databaseUrl(): string {
    return this.getOrThrow('DATABASE_URL');
  }

  get redisUrl(): string {
    return this.getOrThrow('REDIS_URL');
  }

  get redisClusterNodes(): string | undefined {
    return this.configService.get<string>('REDIS_CLUSTER_NODES') || undefined;
  }

  get jwtSecret(): string {
    return this.getOrThrow('JWT_SECRET');
  }

  get jwtExpiresIn(): string {
    return this.configService.get('JWT_EXPIRES_IN', '15m');
  }

  get refreshTokenExpiresInDays(): number {
    return this.configService.get('REFRESH_TOKEN_EXPIRES_IN_DAYS', 7);
  }

  get frontendOrigins(): string | undefined {
    return this.configService.get<string>('FRONTEND_ORIGINS') || undefined;
  }

  get razorpayKeyId(): string {
    return this.getOrThrow('RAZORPAY_KEY_ID');
  }

  get razorpayKeySecret(): string {
    return this.getOrThrow('RAZORPAY_KEY_SECRET');
  }

  get razorpayWebhookSecret(): string {
    return this.getOrThrow('RAZORPAY_WEBHOOK_SECRET');
  }

  get awsAccessKeyId(): string {
    return this.getOrThrow('AWS_ACCESS_KEY_ID');
  }

  get awsSecretAccessKey(): string {
    return this.getOrThrow('AWS_SECRET_ACCESS_KEY');
  }

  get awsRegion(): string {
    return this.configService.get('AWS_REGION', 'us-east-1');
  }

  get awsS3Bucket(): string {
    return this.configService.get('AWS_S3_BUCKET', 'aura-studio');
  }

  get awsS3Endpoint(): string | undefined {
    return this.configService.get<string>('AWS_S3_ENDPOINT') || undefined;
  }

  get sentryDsn(): string | undefined {
    return this.configService.get<string>('SENTRY_DSN') || undefined;
  }

  get adminEmail(): string | undefined {
    return this.configService.get<string>('ADMIN_EMAIL') || undefined;
  }

  get adminPassword(): string | undefined {
    return this.configService.get<string>('ADMIN_PASSWORD') || undefined;
  }
}
