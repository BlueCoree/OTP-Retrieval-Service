import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer, { type Browser } from 'puppeteer-core';
import { mapPrefixedErrorToHttpException } from '../common/exceptions/prefixed-error.mapper';
import * as path from 'path';
import { extractOtps } from './extract-otp';

export interface ExtractedOtp {
    senderEmail: string;
    emailSubject: string;
    emailBody: string;
    emailSentAt: Date;
    otpCode: string;
    inboxAcc: string;
}

@Injectable()
export class BrowserService implements OnModuleInit {
    private readonly logger = new Logger(BrowserService.name);

    private executablePath!: string;
    private userDataDir!: string;

    constructor(private readonly configService: ConfigService) { }

    onModuleInit() {
        this.executablePath = this.configService.get<string>('CHROME_PORTABLE_PATH') || '';
        this.userDataDir = this.configService.get<string>('CHROME_USER_DATA_DIR') || '';

        if (!this.executablePath || !this.userDataDir) {
            this.logger.error('CHROME_PORTABLE_PATH or CHROME_USER_DATA_DIR is not set in .env');
        }
    }

    async fetchLatestOtp(targetSender?: string, profileName: string = 'default'): Promise<ExtractedOtp> {
        let browser: Browser | undefined;

        try {
            this.logger.log(`Launching Chrome Portable with profile: ${profileName}...`);

            const dynamicUserDataDir = path.join(this.userDataDir, profileName);

            browser = await puppeteer.launch({
                executablePath: this.executablePath,
                headless: false,
                args: [
                    `--user-data-dir=${dynamicUserDataDir}`,
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                ],
                defaultViewport: null,
            });

            const page = await browser.newPage();

            page.setDefaultNavigationTimeout(30000);
            page.setDefaultTimeout(15000);

            this.logger.log('Navigating to Email..')
            await page.goto('https://mail.google.com/', { waitUntil: 'networkidle2' });

            const currentUrl = page.url();
            if (currentUrl.includes('accounts.google.com') || currentUrl.includes('signin')) {
                throw new Error('GMAIL_SESSION_EXPIRED: Session expired or not logged in. Please log in manually.');
            }

            await page.waitForSelector('table[role="grid"]', { timeout: 15000 });

            if (targetSender) {
                this.logger.log(`Filtering emails by sender: ${targetSender}`);
                const searchBox = await page.waitForSelector('input[aria-label="Search mail"]');
                if (searchBox) {
                    await searchBox.evaluate(el => (el as HTMLInputElement).value = '');
                    await searchBox.type(`from:${targetSender}`);
                    await page.keyboard.press('Enter');

                    await page.waitForFunction(
                        (sender) => {
                            const spans = document.querySelectorAll('span[email]');
                            return Array.from(spans).some(span => span.getAttribute('email') === sender);
                        },
                        { timeout: 15000 },
                        targetSender
                    ).catch(() => {
                        throw new Error(`NO_EMAIL_FOUND: No matching email found from sender ${targetSender} within timeout.`)
                    });
                }
            }

            const emailRows = await page.$$('table[role="grid"] tbody tr');
            if (emailRows.length === 0) {
                throw new Error('NO_EMAIL_FOUND: No matching email found in inbox.');
            }

            this.logger.log('Opening the lates email..');

            const isClicked = await page.evaluate(() => {
                const rows = document.querySelectorAll('table[role="grid"] tbody tr');
                for (const row of Array.from(rows)) {
                    if (row.querySelectorAll('td').length > 3) {
                        (row as HTMLElement).click();
                        return true;
                    }
                }
                return false;
            });

            if (!isClicked) {
                throw new Error('NO_CLICKABLE_EMAIL: Matching email row found it could not be clicked.');
            }

            await page.waitForSelector('h2[data-thread-perm-id]', { timeout: 10000 });

            const subjectElement = await page.$('h2[data-thread-perm-id]');
            const emailSubject = subjectElement
                ? await page.evaluate(el => el.textContent?.trim() || '', subjectElement)
                : '';

            const senderElement = await page.$('span[email]');
            const senderEmail = senderElement
                ? await page.evaluate(el => el.getAttribute('email') || '', senderElement)
                : '';

            let rawTimeString = '';
            try {
                const timeElement = await page.waitForSelector('span.g3[title]', { timeout: 10000 });
                rawTimeString = timeElement
                    ? await page.evaluate(el => el.getAttribute('title') || '', timeElement)
                    : '';
            } catch {
                throw new Error('EMAIL_DATE_UNREADABLE: Could not find the sent-time element.');
            }

            const emailSentAt = new Date(rawTimeString);
            if (isNaN(emailSentAt.getTime())) {
                throw new Error(`EMAIL_DATE_UNREADABLE: Could not parse sent time "${rawTimeString}".`);
            }

            const bodyElement = await page.$('div[role="listitem"] div[dir="ltr"]');
            const emailBody = bodyElement
                ? await page.evaluate(el => el.innerText?.trim() || '', bodyElement)
                : '';

            if (!emailBody) {
                throw new Error('EMAIL_BODY_EMPTY: Could not read email body.');
            }

            const otpCode = extractOtps(emailBody);
            if (!otpCode) {
                throw new Error('NO_OTP_FOUND: Email found but no OTP code in body.');
            }

            this.logger.log(`OTP extracted successfully for profile ${profileName}`);

            return {
                senderEmail,
                emailSubject,
                emailBody,
                emailSentAt,
                otpCode,
                inboxAcc: profileName,
            };
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw mapPrefixedErrorToHttpException(error.message);
            }

            throw mapPrefixedErrorToHttpException(String(error));
        } finally {
            this.logger.log('Closing browser...');
            if (browser) {
                await browser.close();
            }
        }
    }
}
