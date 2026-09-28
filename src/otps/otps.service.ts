import {
    ConflictException,
    HttpException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BrowserService } from '../browser/browser.service';
import { Mutex } from 'async-mutex';
import { mapPrefixedErrorToHttpException } from '../common/exceptions/prefixed-error.mapper';

@Injectable()
export class OtpsService {
    private readonly logger = new Logger(OtpsService.name);
    private readonly mutex = new Mutex();

    constructor(
        private readonly prisma: PrismaService,
        private readonly browserService: BrowserService,
    ) { }

    async fetchAndStoreOtp(targetSender?: string, profile?: string) {
        return await this.mutex.runExclusive(async () => {
            try {
                const extractedOtp = await this.browserService.fetchLatestOtp(targetSender, profile);

                const existingOtp = await this.prisma.otpEmail.findFirst({
                    where: {
                        senderEmail: extractedOtp.senderEmail,
                        inboxAcc: extractedOtp.inboxAcc,
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                });

                if (existingOtp && existingOtp.emailBody === extractedOtp.emailBody) {
                    this.logger.warn('Email already processed.');
                    throw new ConflictException('DUPLICATE_EMAIL: The latest OTP from this sender has already been stored.');
                }

                const newOtp = await this.prisma.otpEmail.create({
                    data: {
                        senderEmail: extractedOtp.senderEmail,
                        emailSubject: extractedOtp.emailSubject,
                        emailBody: extractedOtp.emailBody,
                        emailSentAt: extractedOtp.emailSentAt,
                        inboxAcc: extractedOtp.inboxAcc,
                        otpCode: extractedOtp.otpCode,
                    }
                });

                return newOtp;
            } catch (error: unknown) {
                if (error instanceof HttpException) {
                    throw error;
                }

                const errMsg = error instanceof Error ? error.message : String(error);
                const mappedError = mapPrefixedErrorToHttpException(errMsg);

                this.logger.error(`Failed to fetch and store OTP: ${errMsg}`);
                throw mappedError;
            }
        });
    }

    async getOtps(page: number = 1, limit: number = 10) {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prisma.otpEmail.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'asc' },
            }),
            this.prisma.otpEmail.count(),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getOtpsById(id: number) {
        const otp = await this.prisma.otpEmail.findUnique({
            where: {
                id,
            }
        });

        if (!otp) {
            throw new NotFoundException(`OTP with ID ${id} not found.`)
        }

        return otp;
    }

    async deleteOtps(id: number) {
        await this.getOtpsById(id);

        await this.prisma.otpEmail.delete({
            where: {
                id,
            }
        });
        return {
            message: `OTP with ID ${id} has been deleted.`
        };
    }
}
