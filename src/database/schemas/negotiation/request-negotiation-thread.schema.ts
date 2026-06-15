import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { RequestForAdmin } from '../requests/request-for-admin.schema';
import { Admin } from '../users/admin.schema';
import { RequestForAdminType } from '../../../common/types/request-for-admin/request-for-admin.types';
import { RequestNegotiationThreadStatus } from '../../../common/types/negotiation/request-negotiation.types';

export type RequestNegotiationThreadDocument = HydratedDocument<RequestNegotiationThread>;

@Schema({
  timestamps: true,
  collection: 'request_negotiation_threads',
  strict: 'throw',
})
export class RequestNegotiationThread {
  @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
  _id: Types.ObjectId;

  // Admin request this conversation belongs to. One ACTIVE thread per request.
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: RequestForAdmin.name,
    index: true,
  })
  requestId: Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(RequestForAdminType),
    immutable: true,
  })
  requestType: RequestForAdminType;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(RequestNegotiationThreadStatus),
    default: RequestNegotiationThreadStatus.ACTIVE,
    index: true,
  })
  status: RequestNegotiationThreadStatus;

  // Counterparty (client or influencer) email/name resolved at creation time.
  @Prop({ required: true, type: String, trim: true, lowercase: true })
  participantEmail: string;

  @Prop({ required: true, type: String, trim: true })
  participantName: string;

  // Base subject used to build the email chain (Re: ...).
  @Prop({ required: true, type: String, trim: true, maxlength: 255 })
  subject: string;

  @Prop({ type: Date })
  lastMessageAt?: Date;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  unreadForAdmin: number;

  @Prop({ required: true, type: Types.ObjectId, ref: Admin.name })
  createdBy: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const RequestNegotiationThreadSchema =
  SchemaFactory.createForClass(RequestNegotiationThread);

// At most one ACTIVE thread per request.
RequestNegotiationThreadSchema.index(
  { requestId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: RequestNegotiationThreadStatus.ACTIVE },
  },
);
