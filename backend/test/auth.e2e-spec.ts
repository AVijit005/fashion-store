import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/config/prisma.service';
import * as cookieParser from 'cookie-parser';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    configureApp(app, app.get(ConfigService));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Gracefully clean up all mock users and sessions from test suite runs
    await prisma.user.deleteMany({});
    await app.close();
  });

  beforeEach(async () => {
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({});
  });

  const testUser = {
    email: 'test@example.com',
    password: 'securePassword123!',
  };

  describe('/auth/signup (POST)', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(testUser)
        .expect(HttpStatus.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(testUser.email.toLowerCase());
      expect(response.body.data.userId).toBeDefined();

      const user = await prisma.user.findUnique({ where: { email: testUser.email } });
      expect(user).toBeDefined();
      expect(user?.passwordHash).not.toBe(testUser.password);
    });

    it('should fail to register an existing user', async () => {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send(testUser)
        .expect(HttpStatus.CREATED);

      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(testUser)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      expect(response.body.message[0]).toContain('already registered');
    });
  });

  describe('/auth/login (POST)', () => {
    it('should login successfully and return access & refresh tokens', async () => {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send(testUser)
        .expect(HttpStatus.CREATED);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(testUser)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      const hasCookie = cookies.some((cookie) => cookie.includes('refresh_token'));
      expect(hasCookie).toBe(true);
    });

    it('should fail with invalid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'wrongpassword' })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });
  });

  describe('/auth/refresh (POST)', () => {
    it('should rotate tokens and prevent reuse (RTR)', async () => {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send(testUser)
        .expect(HttpStatus.CREATED);

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(testUser)
        .expect(HttpStatus.OK);

      const firstRefreshToken = loginRes.body.data.refreshToken;
      const cookieHeader = loginRes.headers['set-cookie'];

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookieHeader)
        .expect(HttpStatus.OK);

      expect(refreshRes.body.data.accessToken).toBeDefined();
      const secondRefreshToken = refreshRes.body.data.refreshToken;
      expect(secondRefreshToken).not.toBe(firstRefreshToken);

      // Attempt token reuse (RTR alert)
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: firstRefreshToken })
        .expect(HttpStatus.UNAUTHORIZED);

      // Verify that all user sessions were revoked upon reuse detection
      const sessions = await prisma.session.findMany({});
      expect(sessions.length).toBe(0);
    });
  });

  describe('/auth/logout (POST)', () => {
    it('should successfully delete the session', async () => {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send(testUser)
        .expect(HttpStatus.CREATED);

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(testUser)
        .expect(HttpStatus.OK);

      const cookieHeader = loginRes.headers['set-cookie'];

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookieHeader)
        .expect(HttpStatus.OK);

      const sessions = await prisma.session.findMany({});
      expect(sessions.length).toBe(0);
    });
  });
});
