import { Request } from 'express';

export interface UserPayload {
    _id: string;
    role: Role;
    email?: string;
}

export interface ClientPayload extends UserPayload {
    isProposalClient?: boolean;
}

export interface AuthenticatedRequest extends Request {
    user: UserPayload;
}

export enum AccountVerifiedStatus {
    accept = 'accept',
    decline = 'decline',
    waitForAdmin = 'waitForAdmin',
    waitForUser = 'waitForUser',
    negotiation = 'negotiation',
}

// User roles enum
export enum Role {
    client = 'client',
    influencer = 'influencer',
    admin = 'admin',
}

// available notification methods
export enum NotificationMethodsEnum {
    whatsapp = 'whatsapp',
    telegram = 'telegram',
}