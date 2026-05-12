import {BadGatewayException, BadRequestException, Injectable, Logger} from "@nestjs/common";
import axios from "axios";
import {Types} from "mongoose";
import {RealtimeNotificationService} from "../../modules/websocket/realtime-notification.service";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {Influencer} from "../../database/schemas/users/influencer.schema";

type SendMessageProps = {
    message: string;
    phone: string;
    sessionId: string;
    clientId?: string;
};

type WhatsappStatus = 'sending' | 'sent' | 'failed';

type WhatsappStatusPayload = {
    phone: string;
    status: WhatsappStatus;
    date: string;
    error?: string;
};

type CampaignWhatsappAccount = {
    messageId: string;
    accountId: string;
    socialMedia: string;
    username: string;
};

type SendCampaignMessagesProps = {
    sessionId: string;
    clientId?: string;
    campaignId: string;
    message: string;
    accounts: CampaignWhatsappAccount[];
};

type CampaignWhatsappStatusPayload = CampaignWhatsappAccount & {
    campaignId: string;
    status: WhatsappStatus;
    date: string;
    error?: string;
};

const BOTASSIUM_WEBHOOK_URL = 'https://api.botassium.com/webhook/GPAqBGdAB94vzfxNaZg2';
const DEVELOPMENT_WHATSAPP_PHONE = '+380935298273';

@Injectable()
export class WhatsappService {
    private readonly logger = new Logger(WhatsappService.name);

    constructor(
        private readonly realtimeNotificationService: RealtimeNotificationService,
        private readonly influencerRepository: InfluencerRepository,
    ) {}

    async sendMessage(props: SendMessageProps): Promise<{ status: 'sent' }> {
        const {message, phone, sessionId, clientId} = props;

        if (!message?.trim()) {
            throw new BadRequestException('Message is required');
        }

        if (!phone?.trim()) {
            throw new BadRequestException('Phone is required');
        }

        this.emitStatus(sessionId, clientId, {
            phone,
            status: 'sending',
            date: new Date().toISOString(),
        });

        try {
            await this.sendTextMessage(message, phone);

            this.emitStatus(sessionId, clientId, {
                phone,
                status: 'sent',
                date: new Date().toISOString(),
            });

            return {status: 'sent'};
        } catch (err) {
            const errorMessage = axios.isAxiosError(err)
                ? err.response?.data?.message ?? err.message
                : err instanceof Error ? err.message : 'Unknown WhatsApp provider error';

            this.logger.error(
                `Failed to send WhatsApp message to ${phone}`,
                err instanceof Error ? err.stack : undefined,
            );

            this.emitStatus(sessionId, clientId, {
                phone,
                status: 'failed',
                date: new Date().toISOString(),
                error: errorMessage,
            });

            throw new BadGatewayException('Failed to send WhatsApp message');
        }
    }

    async sendCampaignMessages(props: SendCampaignMessagesProps): Promise<{ status: 'sent'; count: number; failedCount: number }> {
        const {sessionId, clientId, campaignId, message, accounts} = props;

        if (!message?.trim()) {
            throw new BadRequestException('Message is required');
        }

        if (!Array.isArray(accounts) || accounts.length === 0) {
            throw new BadRequestException('At least one account is required');
        }

        let sentCount = 0;
        let failedCount = 0;

        for (const account of accounts) {
            const basePayload = {
                campaignId,
                messageId: account.messageId,
                accountId: account.accountId,
                socialMedia: account.socialMedia,
                username: account.username,
            };

            this.emitCampaignStatus(sessionId, clientId, {
                ...basePayload,
                status: 'sending',
                date: new Date().toISOString(),
            });

            try {
                const phone = await this.getPhoneForCampaignAccount(account);

                if (!phone) {
                    throw new BadRequestException('Phone number is missing for this influencer');
                }

                await this.sendTextMessage(message, phone);

                sentCount++;
                this.emitCampaignStatus(sessionId, clientId, {
                    ...basePayload,
                    status: 'sent',
                    date: new Date().toISOString(),
                });
            } catch (err) {
                failedCount++;

                const errorMessage = axios.isAxiosError(err)
                    ? err.response?.data?.message ?? err.message
                    : err instanceof Error ? err.message : 'Unknown WhatsApp provider error';

                this.logger.error(
                    `Failed to send campaign WhatsApp message to ${account.socialMedia}:${account.username}`,
                    err instanceof Error ? err.stack : undefined,
                );

                this.emitCampaignStatus(sessionId, clientId, {
                    ...basePayload,
                    status: 'failed',
                    date: new Date().toISOString(),
                    error: errorMessage,
                });
            }
        }

        return {status: 'sent', count: sentCount, failedCount};
    }

    private async sendTextMessage(message: string, phone: string): Promise<void> {
        await axios.post(BOTASSIUM_WEBHOOK_URL, {
            action: 'send-message',
            type: 'text',
            content: message,
            phone: process.env.NODE_ENV === 'development'
                ? DEVELOPMENT_WHATSAPP_PHONE
                : phone,
        });
    }

    private async getPhoneForCampaignAccount(account: CampaignWhatsappAccount): Promise<string | null> {
        if (!Types.ObjectId.isValid(account.accountId)) {
            throw new BadRequestException('Invalid accountId');
        }

        const influencer = await this.influencerRepository.findBySocialAccount(
            account.socialMedia as keyof Influencer,
            new Types.ObjectId(account.accountId),
        );

        const phone = influencer?.phone?.trim();

        return phone || null;
    }

    private emitStatus(sessionId: string, clientId: string | undefined, payload: WhatsappStatusPayload): void {
        if (clientId) {
            this.realtimeNotificationService.emitToClient(sessionId, clientId, 'whatsappMessageStatusUpdate', payload);
            return;
        }

        this.realtimeNotificationService.emitToSession(sessionId, 'whatsappMessageStatusUpdate', payload);
    }

    private emitCampaignStatus(
        sessionId: string,
        clientId: string | undefined,
        payload: CampaignWhatsappStatusPayload,
    ): void {
        if (clientId) {
            this.realtimeNotificationService.emitToClient(
                sessionId,
                clientId,
                'campaignWhatsappMessageStatusUpdate',
                payload,
            );
            return;
        }

        this.realtimeNotificationService.emitToSession(
            sessionId,
            'campaignWhatsappMessageStatusUpdate',
            payload,
        );
    }
}