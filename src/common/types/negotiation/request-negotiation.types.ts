import { ObjId } from '../base.types';
import { RequestForAdminType } from '../request-for-admin/request-for-admin.types';

// Lifecycle of a single negotiation conversation (one per admin request)
export enum RequestNegotiationThreadStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

// Direction of a single negotiation message relative to our system
export enum NegotiationMessageDirection {
  OUTBOUND = 'OUTBOUND', // admin -> participant
  INBOUND = 'INBOUND', // participant -> admin
}

// Delivery state of an OUTBOUND message
export enum NegotiationMessageDeliveryStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

// Resolved counterparty for a given request (client or influencer)
export type NegotiationParticipant = {
  email: string;
  name: string;
};

export type IRequestNegotiationThread = {
  _id: ObjId;
  requestId: ObjId;
  requestType: RequestForAdminType;
  status: RequestNegotiationThreadStatus;
  participantEmail: string;
  participantName: string;
  subject: string;
  lastMessageAt?: Date;
  unreadForAdmin: number;
  createdBy: ObjId;
  createdAt: Date;
  updatedAt: Date;
};
