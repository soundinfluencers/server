import { Controller, Post, Body, HttpCode, Query } from '@nestjs/common';
import { AppGateway } from './app.gateway';

enum TwilioEventType {
    ReqNewPromo = 'req-new-promo',
    Signup = 'signup',
}

const TwilioErrorDescriptions: Record<string, string> = {
    '63049': 'Message rejected by WhatsApp due to policy restrictions',
    '30005': 'Message blocked',
    '11200': 'HTTP retrieval failure',
    '20003': 'Permission denied - Invalid or missing API credentials',
    '21211': 'Invalid To phone number',
    '21610': 'Message cannot be sent: number is blocked',
    '21614': 'Message cannot be sent: number is not a valid mobile number',
    '30003': 'Unreachable destination handset',
    '30004': 'Message failed due to carrier filtering',
    '30007': 'Message delivery failed - spam or restricted content detected',
    '63001': 'WhatsApp: Failed to send message due to invalid template',
    '63016': 'WhatsApp: User has not opted in to receive messages',
    '63032': 'WhatsApp: Message expired before delivery',
};

@Controller('twilio')
export class TwilioController {
    constructor(private readonly gateway: AppGateway) {}

    @Post('status-callback')
    @HttpCode(200)
    async handleStatusCallback(@Body() body: any, @Query('type') type: string): Promise<void> {
        try {
            switch (type) {
                case TwilioEventType.ReqNewPromo:
                    await this.handleReqNewPromo(body);
                    break;

                case TwilioEventType.Signup:
                    await this.handleSignup(body);
                    break;

                default:
                    break;
            }
        } catch (error) {
            console.error(`Error handling Twilio callback for type ${type}:`, error);
        }
    }

    private async handleReqNewPromo(body: any) {
        const errorCode = body.ErrorCode;
        const errorDescription = errorCode ? (TwilioErrorDescriptions[errorCode] ?? 'Unknown error') : null;

        this.gateway.server.emit('req-new-promo', {
            to: body.To,
            status: body.MessageStatus,
            sid: body.MessageSid,
            timestamp: new Date(),
            errorCode,
            errorDescription,
        });
    }

    private async handleSignup(body: any) {
        this.gateway.server.emit('signup-status', {
            to: body.To,
            status: body.MessageStatus,
            sid: body.MessageSid,
            timestamp: new Date(),
            errorCode: body.ErrorCode,
            errorDescription: body.ErrorCode ? (TwilioErrorDescriptions[body.ErrorCode] ?? 'Unknown error') : null,
        });
    }
}
