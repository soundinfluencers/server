import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { RequestNegotiationThread } from './request-negotiation-thread.schema';
import {
  NegotiationMessageDeliveryStatus,
  NegotiationMessageDirection,
} from '../../../common/types/negotiation/request-negotiation.types';

export type RequestNegotiationMessageDocument = HydratedDocument<RequestNegotiationMessage>;

@Schema({ _id: false })
export class NegotiationMessageAttachment {
  @Prop({ required: true, type: String })
  filename: string;

  @Prop({ required: true, type: String })
  mimeType: string;

  @Prop({ required: true, type: Number })
  size: number;

  @Prop({ type: String })
  storageKey?: string;
}

export const NegotiationMessageAttachmentSchema = SchemaFactory.createForClass(
  NegotiationMessageAttachment,
);

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'request_negotiation_messages',
  strict: 'throw',
})
export class RequestNegotiationMessage {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: RequestNegotiationThread.name,
    index: true,
  })
  threadId: Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(NegotiationMessageDirection),
  })
  direction: NegotiationMessageDirection;

  @Prop({ required: true, type: String, trim: true, lowercase: true })
  fromEmail: string;

  @Prop({ required: true, type: String, trim: true, lowercase: true })
  toEmail: string;

  // Admin who sent the message (OUTBOUND only).
  @Prop({ type: Types.ObjectId })
  authorAdminId?: Types.ObjectId;

  @Prop({ type: String, trim: true, maxlength: 255 })
  subject?: string;

  @Prop({ type: String })
  bodyText?: string;

  // Sanitized HTML (sanitization happens before persistence).
  @Prop({ type: String })
  bodyHtml?: string;

  @Prop({ type: [NegotiationMessageAttachmentSchema], default: [] })
  attachments: NegotiationMessageAttachment[];

  // RFC 5322 Message-ID. Unique => idempotency against duplicate delivery.
  @Prop({ required: true, type: String, unique: true })
  messageId: string;

  @Prop({ type: String })
  inReplyTo?: string;

  @Prop({ type: [String], default: [] })
  references: string[];

  @Prop({
    type: String,
    enum: Object.values(NegotiationMessageDeliveryStatus),
  })
  deliveryStatus?: NegotiationMessageDeliveryStatus;

  @Prop({ type: Date })
  readAt?: Date;

  createdAt: Date;
}

export const RequestNegotiationMessageSchema =
  SchemaFactory.createForClass(RequestNegotiationMessage);

RequestNegotiationMessageSchema.index({ threadId: 1, createdAt: 1 });
