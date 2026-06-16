import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { AuthSessionRepository } from '../../database/repositories/auth/auth-session.repository';
import { Role } from '../../common/types/user.types';
import { FilteredNestLogger } from '../../common/logger/filtered-nest-logger';

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

type RedisConnection = {
  isOpen: boolean;
  quit(): Promise<unknown>;
};

@Injectable()
@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  path: '/socket.io',
})
export class AppGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy
{
  private readonly logger = new FilteredNestLogger(AppGateway.name);
  private pubClient?: RedisConnection;
  private subClient?: RedisConnection;

  @WebSocketServer()
  server: Server;

  constructor(
      private readonly jwtService: JwtService,
      private readonly authSessionRepo: AuthSessionRepository,
      private readonly config: ConfigService,
  ) {}

  afterInit(server: Server): void {
    void this.setupRedisAdapter(server);
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnectRedisClient(this.subClient);
    await this.disconnectRedisClient(this.pubClient);
  }

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

  private async setupRedisAdapter(server: Server): Promise<void> {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('Socket.IO Redis adapter disabled: REDIS_URL is missing');
      return;
    }

    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) =>
      this.logger.warn(`Socket.IO Redis pub client error: ${err?.message ?? err}`),
    );
    subClient.on('error', (err) =>
      this.logger.warn(`Socket.IO Redis sub client error: ${err?.message ?? err}`),
    );

    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
      server.adapter(createAdapter(pubClient, subClient));
      this.pubClient = pubClient;
      this.subClient = subClient;
      this.logger.log('Socket.IO Redis adapter connected');
    } catch (err: any) {
      this.logger.error(`Socket.IO Redis adapter setup failed: ${err?.message ?? err}`);
      await this.disconnectRedisClient(subClient);
      await this.disconnectRedisClient(pubClient);
    }
  }

  private async disconnectRedisClient(client?: RedisConnection): Promise<void> {
    if (!client?.isOpen) {
      return;
    }
    try {
      await client.quit();
    } catch (err: any) {
      this.logger.warn(`Socket.IO Redis client quit failed: ${err?.message ?? err}`);
    }
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
