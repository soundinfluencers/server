import {Injectable, Module} from '@nestjs/common';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioWhatsappService {
    private client: Twilio;
    private readonly fromNumber: string;

    constructor() {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        this.fromNumber = 'whatsapp:+447537129190';

        if (!accountSid || !authToken) {
            throw new Error('Twilio credentials are not defined in environment variables.');
        }

        this.client = new Twilio(accountSid, authToken);
    }

    async sendMessage(to: string, message: string): Promise<string> {
        try {
            const response = await this.client.messages.create({
                from: this.fromNumber,
                to: `whatsapp:${to}`,
                body: message,
            });

            return response.sid;
        } catch (error) {
            console.error('Error sending WhatsApp message:', error);
            throw new Error('Failed to send WhatsApp message');
        }
    }
}

@Module({
    providers: [TwilioWhatsappService],
    exports: [TwilioWhatsappService],
})
export class TwilioModule {}