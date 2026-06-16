import { Injectable } from '@nestjs/common';
import { AddressObject, ParsedMail } from 'mailparser';
import sanitizeHtml = require('sanitize-html');
import { RequestNegotiationThreadRepository } from '../../../database/repositories/negotiation/request-negotiation-thread.repository';
import { RequestNegotiationMessageRepository } from '../../../database/repositories/negotiation/request-negotiation-message.repository';
import { RequestNegotiationUnmatchedEmailRepository } from '../../../database/repositories/negotiation/request-negotiation-unmatched-email.repository';
import { RealtimeNotificationService } from '../../websocket/realtime-notification.service';
import { ObjId } from '../../../common/types/base.types';
import { NegotiationMessageDirection } from '../../../common/types/negotiation/request-negotiation.types';
import { RequestNegotiationThreadDocument } from '../../../database/schemas/negotiation/request-negotiation-thread.schema';
import { FilteredNestLogger } from 'src/common/logger/filtered-nest-logger';

const THREAD_ID_RE = /\+([a-f0-9]{24})@/i;

type InboundMessageContext = {
  mailbox: string;
  uid: number;
};

@Injectable()
export class NegotiationInboundProcessor {
  private readonly logger = new FilteredNestLogger(NegotiationInboundProcessor.name);

  constructor(
    private readonly threadRepository: RequestNegotiationThreadRepository,
    private readonly messageRepository: RequestNegotiationMessageRepository,
    private readonly unmatchedEmailRepository: RequestNegotiationUnmatchedEmailRepository,
    private readonly realtime: RealtimeNotificationService,
  ) {}

  // Correlates a parsed inbound email to a thread, persists it idempotently and
  // notifies the admin in real time. Safe to call more than once per email.
  async process(parsed: ParsedMail, context?: InboundMessageContext): Promise<void> {
    const thread = await this.resolveThread(parsed);

    if (!thread) {
      if (!this.extractThreadId(parsed)) {
        this.logger.debug(
          `Skipping non-negotiation inbound email (messageId=${parsed.messageId ?? 'n/a'})`,
        );
        return;
      }
      await this.persistUnmatched(parsed, context);
      return;
    }

    const messageId = parsed.messageId ?? this.fallbackMessageId('inbound', context);
    const fromEmail = this.firstAddress(parsed.from) ?? '';
    const toEmail = this.firstAddress(parsed.to) ?? thread.participantEmail;
    const references = this.normalizeReferences(parsed.references);
    const bodyHtml = parsed.html ? this.sanitize(parsed.html) : undefined;

    this.logger.log(
      `[IMAP] Proccessing negotiation reply from ${fromEmail} on subject: ${parsed?.subject}`,
    );

    const saved = await this.messageRepository.insertIfNew({
      threadId: thread._id,
      direction: NegotiationMessageDirection.INBOUND,
      fromEmail,
      toEmail,
      subject: parsed.subject,
      bodyText: parsed.text,
      bodyHtml,
      messageId,
      inReplyTo: parsed.inReplyTo,
      references,
    });

    if (!saved) {
      this.logger.debug(`Duplicate inbound message ignored (messageId=${messageId})`);
      return;
    }

    const receivedAt = new Date();
    await this.threadRepository.registerInboundMessage(thread._id, receivedAt);

    this.realtime.emitToUser(thread.createdBy.toString(), 'negotiation:newMessage', {
      threadId: thread._id.toString(),
      requestId: thread.requestId.toString(),
      messageId,
      from: fromEmail,
      subject: parsed.subject ?? '',
      preview: (parsed.text ?? '').slice(0, 200),
      receivedAt: receivedAt.toISOString(),
    });
  }

  private async persistUnmatched(
    parsed: ParsedMail,
    context?: InboundMessageContext,
  ): Promise<void> {
    const messageId = parsed.messageId ?? this.fallbackMessageId('unmatched', context);
    const saved = await this.unmatchedEmailRepository.insertIfNew({
      messageId,
      reason: 'No active negotiation thread matched by plus-address or message headers',
      fromEmail: this.firstAddress(parsed.from),
      toEmails: this.allAddresses(parsed.to),
      ccEmails: this.allAddresses(parsed.cc),
      subject: parsed.subject,
      bodyText: parsed.text,
      bodyHtml: parsed.html ? this.sanitize(parsed.html) : undefined,
      inReplyTo: parsed.inReplyTo,
      references: this.normalizeReferences(parsed.references),
      headers: this.headersToRecord(parsed),
      attachments: (parsed.attachments ?? []).map((attachment) => ({
        filename: attachment.filename ?? 'attachment',
        mimeType: attachment.contentType ?? 'application/octet-stream',
        size: attachment.size ?? attachment.content?.length ?? 0,
      })),
    });

    if (saved) {
      this.logger.warn(`Unmatched inbound email saved (messageId=${messageId})`);
    } else {
      this.logger.debug(`Duplicate unmatched inbound email ignored (messageId=${messageId})`);
    }
  }

  private async resolveThread(
    parsed: ParsedMail,
  ): Promise<RequestNegotiationThreadDocument | null> {
    // 1. Primary: threadId embedded in the plus-address we sent as Reply-To.
    const threadId = this.extractThreadId(parsed);
    if (threadId) {
      const byPlus = await this.threadRepository.findActiveById(threadId);
      if (byPlus) {
        return byPlus;
      }
    }

    // 2. Fallback: thread referenced by In-Reply-To / References headers.
    const candidates = [parsed.inReplyTo, ...this.normalizeReferences(parsed.references)].filter(
      (id): id is string => Boolean(id),
    );

    for (const candidateId of candidates) {
      const prior = await this.messageRepository.findByMessageId(candidateId);
      if (prior) {
        const byRef = await this.threadRepository.findActiveById(prior.threadId.toString());
        if (byRef) {
          return byRef;
        }
      }
    }

    return null;
  }

  private extractThreadId(parsed: ParsedMail): string | null {
    for (const address of this.collectRecipientAddresses(parsed)) {
      const match = address.match(THREAD_ID_RE);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  private collectRecipientAddresses(parsed: ParsedMail): string[] {
    const addresses: string[] = [];

    const pushFrom = (field?: AddressObject | AddressObject[]) => {
      if (!field) return;
      const objects = Array.isArray(field) ? field : [field];
      for (const obj of objects) {
        for (const entry of obj.value ?? []) {
          if (entry.address) {
            addresses.push(entry.address.toLowerCase());
          }
        }
      }
    };

    pushFrom(parsed.to);
    pushFrom(parsed.cc);

    const deliveredTo = parsed.headers?.get('delivered-to');
    if (typeof deliveredTo === 'string') {
      addresses.push(deliveredTo.toLowerCase());
    }

    return addresses;
  }

  private firstAddress(field?: AddressObject | AddressObject[]): string | undefined {
    if (!field) return undefined;
    const obj = Array.isArray(field) ? field[0] : field;
    return obj?.value?.[0]?.address?.toLowerCase();
  }

  private allAddresses(field?: AddressObject | AddressObject[]): string[] {
    if (!field) return [];
    const objects = Array.isArray(field) ? field : [field];
    return objects.flatMap((obj) =>
      (obj.value ?? [])
        .map((entry) => entry.address?.toLowerCase())
        .filter((address): address is string => Boolean(address)),
    );
  }

  private normalizeReferences(references?: string | string[]): string[] {
    if (!references) return [];
    return Array.isArray(references) ? references : [references];
  }

  private fallbackMessageId(
    kind: 'inbound' | 'unmatched',
    context?: InboundMessageContext,
  ): string {
    if (context) {
      return `<${context.mailbox.toLowerCase()}.${context.uid}@${kind}.local>`;
    }
    return `<${new ObjId().toString()}@${kind}.local>`;
  }

  private headersToRecord(parsed: ParsedMail): Record<string, string | string[]> {
    const headers: Record<string, string | string[]> = {};
    for (const [key, value] of parsed.headers ?? []) {
      headers[key] = this.normalizeHeaderValue(value);
    }
    return headers;
  }

  private normalizeHeaderValue(value: unknown): string | string[] {
    if (Array.isArray(value)) {
      return value.map((entry) => this.normalizeHeaderValue(entry) as string);
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      return value;
    }
    if (value && typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value ?? '');
  }

  private sanitize(html: string): string {
    return sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ['src', 'alt'],
      },
      allowedSchemes: ['http', 'https', 'mailto', 'cid'],
    });
  }
}
