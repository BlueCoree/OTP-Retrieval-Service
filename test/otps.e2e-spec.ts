jest.mock('./../src/browser/browser.service', () => ({
  BrowserService: class {}
}));

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect, jest } from '@jest/globals';
import { AppModule } from './../src/app.module';
import { BrowserService } from './../src/browser/browser.service';

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
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(BrowserService)
      .useValue(browserService)
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