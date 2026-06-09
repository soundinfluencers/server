import { BadRequestException, ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../../integrations/email/email.service';
import { RequestNegotiationThreadRepository } from '../../../database/repositories/negotiation/request-negotiation-thread.repository';
import { RequestNegotiationMessageRepository } from '../../../database/repositories/negotiation/request-negotiation-message.repository';
import { ObjId } from '../../../common/types/base.types';
import {
  NegotiationMessageDeliveryStatus,
  NegotiationMessageDirection,
} from '../../../common/types/negotiation/request-negotiation.types';
import { RequestNegotiationMessageDocument } from '../../../database/schemas/negotiation/request-negotiation-message.schema';
import { SendNegotiationMessageDto } from '../dto/request-negotiation.dto';
import { RealtimeNotificationService } from '../../websocket/realtime-notification.service';

@Injectable()
export class SendNegotiationMessageService {
  private readonly logger = new Logger(SendNegotiationMessageService.name);

  constructor(
    private readonly threadRepository: RequestNegotiationThreadRepository,
    private readonly messageRepository: RequestNegotiationMessageRepository,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeNotificationService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  private static readonly SEND_COOLDOWN_MS = 3000;

  async exec(
    requestId: string,
    adminId: string,
    dto: SendNegotiationMessageDto,
  ): Promise<RequestNegotiationMessageDocument> {
    const thread = await this.threadRepository.findActiveByRequestId(requestId);

    if (!thread) {
      throw new BadRequestException('No active negotiation for this request. Start it first.');
    }

    // Anti double-send: short cooldown per thread guards against duplicate
    // submits (double click / retry) producing two emails.
    const cooldownKey = `negotiation:send:${thread._id.toString()}`;
    if (await this.cacheManager.get(cooldownKey)) {
      throw new ConflictException('A message was just sent — please wait a moment.');
    }
    await this.cacheManager.set(cooldownKey, '1', SendNegotiationMessageService.SEND_COOLDOWN_MS);

    const previous = await this.messageRepository.findLastByThread(thread._id);
    const fromEmail = this.config.get<string>('EMAIL_USER') ?? '';
    const replyTo = this.buildReplyToAddress(thread._id.toString());
    const subject = thread.lastMessageAt ? `Re: ${thread.subject}` : thread.subject;
    const references = previous ? [...(previous.references ?? []), previous.messageId] : [];

    const bodyHtml = this.toHtml(dto.body);

    const info = await this.emailService.send({
      to: thread.participantEmail,
      subject,
      html: bodyHtml,
      text: dto.body,
      replyTo,
      inReplyTo: previous?.messageId,
      references,
    });

    const messageId =
      (info as { messageId?: string })?.messageId ?? `<${new ObjId().toString()}@local>`;

    const saved = await this.messageRepository.insertIfNew({
      threadId: thread._id,
      direction: NegotiationMessageDirection.OUTBOUND,
      fromEmail,
      toEmail: thread.participantEmail,
      authorAdminId: new ObjId(adminId),
      subject,
      bodyText: dto.body,
      bodyHtml,
      messageId,
      inReplyTo: previous?.messageId,
      references,
      deliveryStatus: NegotiationMessageDeliveryStatus.SENT,
    });

    await this.threadRepository.touchLastMessageAt(thread._id, new Date());

    this.realtime.emitToUser(thread.createdBy.toString(), 'negotiation:messageStatus', {
      threadId: thread._id.toString(),
      requestId,
      messageId,
      direction: NegotiationMessageDirection.OUTBOUND,
      deliveryStatus: NegotiationMessageDeliveryStatus.SENT,
    });

    // saved is null only on the (practically impossible) messageId collision.
    return saved ?? (await this.messageRepository.findLastByThread(thread._id))!;
  }

  // Reply-To carries the threadId via plus-addressing so inbound replies can be
  // correlated back to this conversation. Defaults derive from EMAIL_USER.
  private buildReplyToAddress(threadId: string): string {
    const emailUser = this.config.get<string>('EMAIL_USER') ?? '';
    const [localFromUser, domainFromUser] = emailUser.split('@');
    const local = this.config.get<string>('NEGOTIATION_INBOX_LOCAL') || localFromUser;
    const domain = this.config.get<string>('NEGOTIATION_REPLY_DOMAIN') || domainFromUser;
    return `${local}+${threadId}@${domain}`;
  }

  private toHtml(body: string): string {
    const escaped = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<p>${escaped.replace(/\r?\n/g, '<br/>')}</p>`;
  }
}
