import { Injectable, Module } from '@nestjs/common';
import { Twilio } from 'twilio';

export interface TwilioSendNewPromoRequestVariables {
    socialMediaUsername: string;
    socialMedia: string;
    link: string;
    postDesc: string;
    storyTag: string;
    storyLink: string;
}

@Injectable()
export class TwilioWhatsappService {
    private client: Twilio;
    private readonly fromNumber: string;

    constructor() {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        this.fromNumber = process.env.TWILIO_SENDER;

        if (!accountSid || !authToken || !this.fromNumber) {
            throw new Error('Twilio credentials or sender number are not defined in environment variables.');
        }

        this.client = new Twilio(accountSid, authToken);
    }

    private sanitizeVariable(value: string | undefined | null): string {
        if (!value) return 'Not provided';
        return value
            .replace(/\s{4,}/g, ' ')
            .replace(/\n+/g, ' ')
            .replace(/[\uD800-\uDFFF]./g, '')
            .trim();
    }

    async sendNewPromoRequest(to: string, variables: TwilioSendNewPromoRequestVariables): Promise<string> {
        try {
            const sanitizedVariables: TwilioSendNewPromoRequestVariables = {
                socialMediaUsername: this.sanitizeVariable(variables.socialMediaUsername),
                socialMedia: this.sanitizeVariable(variables.socialMedia),
                link: this.sanitizeVariable(variables.link),
                postDesc: this.sanitizeVariable(variables.postDesc),
                storyTag: this.sanitizeVariable(variables.storyTag),
                storyLink: this.sanitizeVariable(variables.storyLink),
            };

            const contentVariables = JSON.stringify(sanitizedVariables);

            const response = await this.client.messages.create({
                from: this.fromNumber,
                to: `whatsapp:${to}`,
                contentSid: process.env.TWILIO_NEW_PROMO_REQUEST_TEMPLATE_SID,
                contentVariables: contentVariables,
            });

            return response.sid;
        } catch (error) {
            console.error('Error sending WhatsApp message:', error);
            throw new Error(`Failed to send WhatsApp message: ${error.message}`);
        }
    }
}

@Module({
    providers: [TwilioWhatsappService],
    exports: [TwilioWhatsappService],
})
export class TwilioModule {}