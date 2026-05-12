import { Injectable } from '@nestjs/common';
import { AppGateway } from './app.gateway';

@Injectable()
export class RealtimeNotificationService {
    constructor(private readonly appGateway: AppGateway) {}

    emitToUser(userId: string, event: string, payload: unknown): void {
        this.appGateway.emitToUser(userId, event, payload);
    }

    emitToSession(sessionId: string, event: string, payload: unknown): void {
        this.appGateway.emitToSession(sessionId, event, payload);
    }

    emitToClient(sessionId: string, clientId: string, event: string, payload: unknown): void {
        this.appGateway.emitToClient(sessionId, clientId, event, payload);
    }
}
