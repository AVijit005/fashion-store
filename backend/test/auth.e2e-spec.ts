import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/config/prisma.service';
import cookieParser from 'cookie-parser';

async function getCsrfToken(agent: request.SuperTest<request.Test>): Promise<string> {
  const res = await agent.get('/auth/csrf').expect(HttpStatus.OK);
  const cookies = res.headers['set-cookie'] as unknown as string[];
  const xsrfCookie = cookies.find((c) => c.startsWith('XSRF-TOKEN='));
  if (!xsrfCookie) {
    throw new Error('XSRF-TOKEN cookie not set by /auth/csrf');
  }
  return xsrfCookie.split(';')[0].split('=')[1];
}

function extractXsrfToken(cookies: string[]): string {
  const cookie = cookies.find((c) => c.startsWith('XSRF-TOKEN='));
  if (!cookie) {
    throw new Error('XSRF-TOKEN cookie missing in response');
  }
  return cookie.split(';')[0].split('=')[1];
}

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
      const csrfToken = await getCsrfToken(request(app.getHttpServer()));
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .set('X-XSRF-TOKEN', csrfToken)
        .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
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
      const csrfToken = await getCsrfToken(request(app.getHttpServer()));

      await request(app.getHttpServer())
        .post('/auth/signup')
        .set('X-XSRF-TOKEN', csrfToken)
        .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
        .send(testUser)
        .expect(HttpStatus.CREATED);

      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .set('X-XSRF-TOKEN', csrfToken)
        .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
        .send(testUser)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      expect(response.body.message[0]).toContain('already registered');
    });
  });

  describe('/auth/login (POST)', () => {
    it('should login successfully and set httpOnly auth cookies without exposing tokens in the body', async () => {
      const csrfToken = await getCsrfToken(request(app.getHttpServer()));

      await request(app.getHttpServer())
        .post('/auth/signup')
        .set('X-XSRF-TOKEN', csrfToken)
        .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
        .send(testUser)
        .expect(HttpStatus.CREATED);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-XSRF-TOKEN', csrfToken)
        .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
        .send(testUser)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).not.toHaveProperty('accessToken');
      expect(response.body.data).not.toHaveProperty('refreshToken');
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(testUser.email.toLowerCase());

      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      const hasRefreshCookie = cookies.some((cookie) => cookie.includes('refresh_token'));
      expect(hasRefreshCookie).toBe(true);
      const hasAccessCookie = cookies.some((cookie) => cookie.includes('access_token'));
      expect(hasAccessCookie).toBe(true);
      const hasXsrfCookie = cookies.some((cookie) => cookie.startsWith('XSRF-TOKEN='));
      expect(hasXsrfCookie).toBe(true);
    });

    it('should fail with invalid credentials', async () => {
      const csrfToken = await getCsrfToken(request(app.getHttpServer()));
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-XSRF-TOKEN', csrfToken)
        .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
        .send({ email: 'nonexistent@example.com', password: 'wrongpassword' })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });

    it('should reject login without the CSRF token header and succeed with the correct token', async () => {
      const csrfToken = await getCsrfToken(request(app.getHttpServer()));

      await request(app.getHttpServer())
        .post('/auth/signup')
        .set('X-XSRF-TOKEN', csrfToken)
        .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
        .send(testUser)
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
        .send(testUser)
        .expect(HttpStatus.FORBIDDEN);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-XSRF-TOKEN', csrfToken)
        .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
        .send(testUser)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
    });

    it('should return 429 Too Many Requests after 5 failed login attempts within 15 minutes', async () => {
      const csrfToken = await getCsrfToken(request(app.getHttpServer()));

      await request(app.getHttpServer())
        .post('/auth/signup')
        .set('X-XSRF-TOKEN', csrfToken)
        .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
        .send(testUser)
        .expect(HttpStatus.CREATED);

      for (let i = 0; i < 5; i += 1) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .set('X-XSRF-TOKEN', csrfToken)
          .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
          .send({ email: testUser.email, password: 'wrong-password' })
          .expect(HttpStatus.UNAUTHORIZED);
      }

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-XSRF-TOKEN', csrfToken)
        .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
        .send({ email: testUser.email, password: 'wrong-password' })
        .expect(HttpStatus.TOO_MANY_REQUESTS);

      expect(response.body.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });
  });

  describe('/auth/refresh (POST)', () => {
    it('should rotate tokens via cookie and prevent reuse (RTR)', async () => {
      const csrfToken = await getCsrfToken(request(app.getHttpServer()));

      await request(app.getHttpServer())
        .post('/auth/signup')
        .set('X-XSRF-TOKEN', csrfToken)
        .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
        .send(testUser)
        .expect(HttpStatus.CREATED);

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-XSRF-TOKEN', csrfToken)
        .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
        .send(testUser)
        .expect(HttpStatus.OK);

      const firstCookieHeader = loginRes.headers['set-cookie'];
      expect(loginRes.body.data).not.toHaveProperty('accessToken');
      expect(loginRes.body.data).not.toHaveProperty('refreshToken');

      const loginXsrfToken = extractXsrfToken(firstCookieHeader as string[]);

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', firstCookieHeader)
        .set('X-XSRF-TOKEN', loginXsrfToken)
        .expect(HttpStatus.OK);

      expect(refreshRes.body.data).not.toHaveProperty('accessToken');
      expect(refreshRes.body.data).not.toHaveProperty('refreshToken');
      expect(refreshRes.body.data.message).toBe('Token rotated successfully');

      const secondCookieHeader = refreshRes.headers['set-cookie'];
      const firstRefreshCookie = ((firstCookieHeader as unknown) as string[]).find((c) =>
        c.startsWith('refresh_token='),
      );
      const secondRefreshCookie = ((secondCookieHeader as unknown) as string[]).find((c) =>
        c.startsWith('refresh_token='),
      );
      expect(secondRefreshCookie).not.toBe(firstRefreshCookie);

      // Attempt token reuse with the old cookie (RTR alert)
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', firstCookieHeader)
        .set('X-XSRF-TOKEN', loginXsrfToken)
        .expect(HttpStatus.UNAUTHORIZED);

      // Verify that all user sessions were revoked upon reuse detection
      const sessions = await prisma.session.findMany({});
      expect(sessions.length).toBe(0);
    });
  });

  describe('/auth/logout (POST)', () => {
    it('should successfully delete the session', async () => {
      const csrfToken = await getCsrfToken(request(app.getHttpServer()));

      await request(app.getHttpServer())
        .post('/auth/signup')
        .set('X-XSRF-TOKEN', csrfToken)
        .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
        .send(testUser)
        .expect(HttpStatus.CREATED);

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-XSRF-TOKEN', csrfToken)
        .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
        .send(testUser)
        .expect(HttpStatus.OK);

      const cookieHeader = loginRes.headers['set-cookie'];
      const loginXsrfToken = extractXsrfToken(cookieHeader as string[]);

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookieHeader)
        .set('X-XSRF-TOKEN', loginXsrfToken)
        .expect(HttpStatus.OK);

      const sessions = await prisma.session.findMany({});
      expect(sessions.length).toBe(0);
    });
  });
});
