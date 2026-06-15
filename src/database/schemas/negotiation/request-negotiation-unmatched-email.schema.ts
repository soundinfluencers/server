import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RequestNegotiationUnmatchedEmailDocument =
  HydratedDocument<RequestNegotiationUnmatchedEmail>;

@Schema({ _id: false })
export class UnmatchedEmailAttachment {
  @Prop({ required: true, type: String })
  filename: string;

  @Prop({ required: true, type: String })
  mimeType: string;

  @Prop({ required: true, type: Number })
  size: number;
}

export const UnmatchedEmailAttachmentSchema =
  SchemaFactory.createForClass(UnmatchedEmailAttachment);

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'request_negotiation_unmatched_emails',
  strict: 'throw',
})
export class RequestNegotiationUnmatchedEmail {
  @Prop({ required: true, type: String, unique: true })
  messageId: string;

  @Prop({ required: true, type: String })
  reason: string;

  @Prop({ type: String, trim: true, lowercase: true })
  fromEmail?: string;

  @Prop({ type: [String], default: [] })
  toEmails: string[];

  @Prop({ type: [String], default: [] })
  ccEmails: string[];

  @Prop({ type: String, trim: true, maxlength: 255 })
  subject?: string;

  @Prop({ type: String })
  bodyText?: string;

  @Prop({ type: String })
  bodyHtml?: string;

  @Prop({ type: String })
  inReplyTo?: string;

  @Prop({ type: [String], default: [] })
  references: string[];

  @Prop({ type: Object, default: {} })
  headers: Record<string, string | string[]>;

  @Prop({ type: [UnmatchedEmailAttachmentSchema], default: [] })
  attachments: UnmatchedEmailAttachment[];

  createdAt: Date;
}

export const RequestNegotiationUnmatchedEmailSchema =
  SchemaFactory.createForClass(RequestNegotiationUnmatchedEmail);
