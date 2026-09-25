import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer, { type Browser } from 'puppeteer-core';
import { mapPrefixedErrorToHttpException } from '../common/exceptions/prefixed-error.mapper';

export interface ExtractedOtp {
    senderEmail: string;
    emailSubject: string;
    emailBody: string;
    emailSentAt: Date;
    otpCode: string;
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

    async fetchLatestOtp(targetSender?: string): Promise<ExtractedOtp> {
        let browser: Browser | undefined;

        try {
            this.logger.log('Launching Chrome Portable...')

            browser = await puppeteer.launch({
                executablePath: this.executablePath,
                headless: false,
                args: [
                    `--user-data-dir=${this.userDataDir}`,
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

            const timeElement = await page.$('span[data-tooltip]');
            let emailSentAt = new Date();
            if (timeElement) {
                const rawTimeString = await page.evaluate(el => el.getAttribute('data-tooltip') || el.textContent || '', timeElement);
                const parsedData = new Date(rawTimeString);
                if (!isNaN(parsedData.getTime())) {
                    emailSentAt = parsedData;
                }
            }

            const bodyElement = await page.$('div[role="listitem"] div[dir="ltr"]');
            const emailBody = bodyElement
                ? await page.evaluate(el => el.innerText?.trim() || '', bodyElement)
                : '';

            if (!emailBody) {
                throw new Error('EMAIL_BODY_EMPTY: Could not read email body.');
            }

            const otpMatch = emailBody.match(/\b\d{4,8}\b/);
            if (!otpMatch) {
                throw new Error('NO_OTP_FOUND: Email found but no OTP code in body.');
            }

            const otpCode = otpMatch[0];

            this.logger.log(`OTP extracted successfully: ${otpCode}`);

            return {
                senderEmail,
                emailSubject,
                emailBody,
                emailSentAt,
                otpCode
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
