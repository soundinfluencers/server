import { Request } from 'express';

export interface UserPayload {
    _id: string;
    role: Role;
    email?: string;
}

export interface AuthenticatedRequest extends Request {
    user: UserPayload;
}

// User roles enum
export enum Role {
    client = 'client',
    influencer = 'influencer',
    admin = 'admin',
}