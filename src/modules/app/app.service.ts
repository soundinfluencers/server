import {BadRequestException, Injectable, Logger} from '@nestjs/common';
import {EmailService} from "../../integrations/email/email.service";
import {TestEmailKey, TestEmailRegistry} from "../../integrations/email/email-test.registry";

@Injectable()
export class AppService {
    constructor(
        private readonly emailService: EmailService,
    ) {
    }

    private readonly logger = new Logger();

    // Sends all of available emails to us for testing
    async sendTestEmails(): Promise<void> {
        for (const [key, buildMessage] of Object.entries(TestEmailRegistry)) {
            try {
                const message = buildMessage();
                await this.emailService.send(message);
                this.logger.log(`Test email sent: ${key}`);
            } catch (error) {
                this.logger.error(`Failed to send test email: ${key}`, error);
            }
        }
    }

    // Sends selected email
    async sendSelectedTestEmail(key: TestEmailKey): Promise<void> {
        const buildMessage = TestEmailRegistry[key];

        if (!buildMessage) {
            throw new BadRequestException(`Unknown test email key: ${key}`);
        }

        const message = buildMessage();

        await this.emailService.send(message);
        this.logger.log(`Test email sent: ${key}`);
    }
}
