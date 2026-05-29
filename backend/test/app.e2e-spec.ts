import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET) - Should return 404 since no default root route is defined', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });

  it('/health (GET) - Should return 200 with services health status', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toEqual({
      success: true,
      timestamp: expect.any(String),
      data: {
        status: 'OK',
        timestamp: expect.any(String),
        services: {
          database: 'UP',
          redis: 'UP',
        },
      },
    });
  });
});
