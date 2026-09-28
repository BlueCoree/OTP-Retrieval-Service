jest.mock('./../src/browser/browser.service', () => ({
  BrowserService: class {}
}));

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect, jest } from '@jest/globals';
import { OtpsModule } from './../src/otps/otps.module';
import { BrowserService } from './../src/browser/browser.service';
import { PrismaService } from './../src/prisma.service';

describe('OtpsController (e2e)', () => {
  let app: INestApplication;
  let browserService = {
    fetchLatestOtp: jest.fn(async () => ({
      senderEmail: 'e2e@example.com',
      emailSubject: 'E2E Test Subject',
      emailBody: 'Your verification code is 999999.',
      emailSentAt: new Date(),
      otpCode: '999999',
      inboxAcc: 'e2e-profile',
    })),
  };

  beforeAll(async () => {
    const otpStore = new Map<number, any>();

    const prismaMock = {
      otpEmail: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async ({ data }: { data: any }) => {
          const id = (otpStore.size + 1) || 1;
          const record = { id, ...data, createdAt: new Date() };
          otpStore.set(id, record);
          return record;
        }),
        findMany: jest.fn(async () => Array.from(otpStore.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())),
        count: jest.fn(async () => otpStore.size),
        findUnique: jest.fn(async ({ where }) => otpStore.get(where.id) ?? null),
        delete: jest.fn(async ({ where }) => {
          const deleted = otpStore.get(where.id);
          otpStore.delete(where.id);
          return deleted;
        }),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [OtpsModule],
    })
      .overrideProvider(BrowserService)
      .useValue(browserService)
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  let createdOtpId: number;

  it('/otps/fetch (POST) - should create OTP', async () => {
    const response = await request(app.getHttpServer())
      .post('/otps/fetch')
      .send({ sender: 'e2e@example.com', profile: 'e2e-profile' })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.otpCode).toBe('999999');
    createdOtpId = response.body.id;
  });

  it('/otps (GET) - should return paginated list', async () => {
    const response = await request(app.getHttpServer())
      .get('/otps?page=1&limit=5')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('meta');
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('/otps/:id (GET) - should return specific OTP', async () => {
    const response = await request(app.getHttpServer())
      .get(`/otps/${createdOtpId}`)
      .expect(200);

    expect(response.body.id).toBe(createdOtpId);
  });

  it('/otps/:id (DELETE) - should delete specific OTP', async () => {
    await request(app.getHttpServer())
      .delete(`/otps/${createdOtpId}`)
      .expect(200);
      
    await request(app.getHttpServer())
      .get(`/otps/${createdOtpId}`)
      .expect(404);
  });
});