import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { AuthSessionRepository } from '../../database/repositories/auth/auth-session.repository';
import { Role } from '../../common/types/user.types';

type AuthenticatedSocket = Socket & {
  data: {
    userId?: string;
    sessionId?: string;
    clientId?: string;
  };
};

type SocketJwtPayload = {
  sub?: string;
  sid?: string;
  _id?: string;
  role?: Role;
};

@Injectable()
@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  path: '/socket.io',
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AppGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
      private readonly jwtService: JwtService,
      private readonly authSessionRepo: AuthSessionRepository,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const auth = client.handshake.auth as { token?: unknown; clientId?: unknown };
      const token = this.normalizeBearerToken(auth?.token);
      const clientId = this.getClientId(auth?.clientId);

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<SocketJwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });

      const userId = payload.sub ?? payload._id;
      const sessionId = payload.sid;

      if (!userId || !sessionId || !payload.role) {
        client.disconnect(true);
        return;
      }

      const session = await this.authSessionRepo.findActiveForUser(sessionId, userId, payload.role);

      if (!session) {
        client.disconnect(true);
        return;
      }

      client.data.userId = userId;
      client.data.sessionId = sessionId;
      client.data.clientId = clientId;

      await client.join(`user:${userId}`);
      await client.join(`session:${sessionId}`);

      if (clientId) {
        await client.join(`client:${sessionId}:${clientId}`);
      }

      this.logger.log(`Socket connected: ${client.id}, user: ${userId}, session: ${sessionId}`);
    } catch (err) {
      this.logger.warn(`Unauthorized socket connection: ${err instanceof Error ? err.message : String(err)}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitToSession(sessionId: string, event: string, payload: unknown): void {
    this.server.to(`session:${sessionId}`).emit(event, payload);
  }

  emitToClient(sessionId: string, clientId: string, event: string, payload: unknown): void {
    this.server.to(`client:${sessionId}:${clientId}`).emit(event, payload);
  }

  sendWhatsappMessageStatusUpdate(sessionId: string, status: unknown): void {
    this.emitToSession(sessionId, 'whatsappMessageStatusUpdate', status);
  }

  private normalizeBearerToken(rawToken: unknown): string | null {
    if (typeof rawToken !== 'string') {
      return null;
    }

    return rawToken.replace(/^Bearer\s+/i, '').trim() || null;
  }

  private getClientId(rawClientId: unknown): string | undefined {
    if (typeof rawClientId !== 'string') {
      return undefined;
    }

    const clientId = rawClientId.trim();
    return clientId.length > 0 ? clientId : undefined;
  }
}