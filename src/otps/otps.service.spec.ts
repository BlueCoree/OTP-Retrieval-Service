jest.mock('../prisma.service', () => ({
  PrismaService: class { }
}));
jest.mock('../browser/browser.service', () => ({
  BrowserService: class { }
}));

import { Test, TestingModule } from '@nestjs/testing';
import { OtpsService } from './otps.service';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { PrismaService } from '../prisma.service';
import { BrowserService, ExtractedOtp } from '../browser/browser.service';
import { ConflictException } from '@nestjs/common';

describe('OtpsService', () => {
  let service: OtpsService;
  let prismaService: PrismaService;
  let browserService: BrowserService;

  const mockExtractedOtp: ExtractedOtp = {
    senderEmail: "test@example.com",
    emailSubject: "Your OTP",
    emailBody: "Your verification code is 43245655",
    emailSentAt: new Date(),
    otpCode: "43245655",
    inboxAcc: "profile",
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OtpsService,
        {
          provide: PrismaService,
          useValue: {
            otpEmail: {
              findFirst: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: BrowserService,
          useValue: {
            fetchLatestOtp: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OtpsService>(OtpsService);
    prismaService = module.get<PrismaService>(PrismaService);
    browserService = module.get<BrowserService>(BrowserService);
  });

  it('should successfully fetch and store a new OTP', async () => {
    jest.spyOn(browserService, "fetchLatestOtp").mockResolvedValue(mockExtractedOtp);
    jest.spyOn(prismaService.otpEmail, "findFirst").mockResolvedValue(null);
    jest.spyOn(prismaService.otpEmail, "create").mockResolvedValue({ id: 1, ...mockExtractedOtp, createdAt: new Date() } as any);

    const result = await service.fetchAndStoreOtp("test@example.com", "profile");

    expect(result).toBeDefined();
    expect(result.otpCode).toBe("43245655");
    expect(prismaService.otpEmail.create).toHaveBeenCalledWith({ data: mockExtractedOtp });
  });

  it('should throw ConflictException if OTP is a duplicate', async () => {
    jest.spyOn(browserService, "fetchLatestOtp").mockResolvedValue(mockExtractedOtp);
    jest.spyOn(prismaService.otpEmail, "findFirst").mockResolvedValue({ id: 1, ...mockExtractedOtp, createdAt: new Date() } as any);

    await expect(service.fetchAndStoreOtp("test@example.com", "profile"))
      .rejects.toThrow(ConflictException);
  })
});
