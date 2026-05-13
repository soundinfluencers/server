import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { RealtimeNotificationService } from '../../modules/websocket/realtime-notification.service';

type SendMessageProps = {
  message: string;
  phone: string;
  sessionId: string;
  clientId?: string;
};

type SendMessagesRecipient = {
  phone: string;
  meta?: Record<string, unknown>;
};

type SendMessagesProps = {
  sessionId: string;
  clientId?: string;
  message: string;
  recipients: SendMessagesRecipient[];
};

type WhatsappStatus = 'sending' | 'sent' | 'failed';

type WhatsappStatusPayload = {
  phone: string;
  status: WhatsappStatus;
  date: string;
  error?: string;
};

type BulkWhatsappStatusPayload = {
  phone: string;
  meta?: Record<string, unknown>;
  status: WhatsappStatus;
  date: string;
  error?: string;
};

const BOTASSIUM_WEBHOOK_URL = process.env.BOTASSIUM_WEBHOOK_URL;
const DEVELOPMENT_WHATSAPP_PHONE = '+380935298273';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly realtimeNotificationService: RealtimeNotificationService) {}

  async sendMessage(props: SendMessageProps): Promise<{ status: 'sent' }> {
    const { message, phone, sessionId, clientId } = props;

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

      return { status: 'sent' };
    } catch (err) {
      const errorMessage = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? err.message)
        : err instanceof Error
          ? err.message
          : 'Unknown WhatsApp provider error';

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

  async sendMessages(
    props: SendMessagesProps,
  ): Promise<{ status: 'sent'; count: number; failedCount: number }> {
    const { sessionId, clientId, message, recipients } = props;

    if (!message?.trim()) {
      throw new BadRequestException('Message is required');
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new BadRequestException('At least one recipient is required');
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      this.emitBulkStatus(sessionId, clientId, {
        phone: recipient.phone,
        meta: recipient.meta,
        status: 'sending',
        date: new Date().toISOString(),
      });

      try {
        await this.sendTextMessage(message, recipient.phone);

        sentCount++;
        this.emitBulkStatus(sessionId, clientId, {
          phone: recipient.phone,
          meta: recipient.meta,
          status: 'sent',
          date: new Date().toISOString(),
        });
      } catch (err) {
        failedCount++;

        const errorMessage = axios.isAxiosError(err)
          ? (err.response?.data?.message ?? err.message)
          : err instanceof Error
            ? err.message
            : 'Unknown WhatsApp provider error';

        this.logger.error(
          `Failed to send WhatsApp message to ${recipient.phone}`,
          err instanceof Error ? err.stack : undefined,
        );

        this.emitBulkStatus(sessionId, clientId, {
          phone: recipient.phone,
          meta: recipient.meta,
          status: 'failed',
          date: new Date().toISOString(),
          error: errorMessage,
        });
      }
    }

    return { status: 'sent', count: sentCount, failedCount };
  }

  private async sendTextMessage(message: string, phone: string): Promise<void> {
    await axios.post(BOTASSIUM_WEBHOOK_URL, {
      action: 'send-message',
      type: 'text',
      content: message,
      phone: process.env.NODE_ENV === 'development' ? DEVELOPMENT_WHATSAPP_PHONE : phone,
    });
  }

  private emitStatus(
    sessionId: string,
    clientId: string | undefined,
    payload: WhatsappStatusPayload,
  ): void {
    if (clientId) {
      this.realtimeNotificationService.emitToClient(
        sessionId,
        clientId,
        'whatsappMessageStatusUpdate',
        payload,
      );
      return;
    }

    this.realtimeNotificationService.emitToSession(
      sessionId,
      'whatsappMessageStatusUpdate',
      payload,
    );
  }

  private emitBulkStatus(
    sessionId: string,
    clientId: string | undefined,
    payload: BulkWhatsappStatusPayload,
  ): void {
    if (clientId) {
      this.realtimeNotificationService.emitToClient(
        sessionId,
        clientId,
        'whatsappBulkStatusUpdate',
        payload,
      );
      return;
    }

    this.realtimeNotificationService.emitToSession(sessionId, 'whatsappBulkStatusUpdate', payload);
  }
}
