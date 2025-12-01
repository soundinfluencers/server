import { Request } from 'express';

export interface UserPayload {
    _id: string;
    email?: string;
}

export interface AuthenticatedRequest extends Request {
    user: UserPayload;
}