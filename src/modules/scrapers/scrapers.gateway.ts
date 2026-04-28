import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import type { UserPayload } from '../../common/types/user.types';

@Injectable()
@WebSocketGateway({  path: '/scrapers-socket.io' })
export class ScrapersGateway {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ScrapersGateway.name);

    /** список пользователей, рефрешащих посты в кампаниях */
    private activePostDetailsUpdates: Record<string, { campaignId: string; accountIds: string[] }[]> = {};
    private activeAccountsUpdates: Record<string, { socialMedia: string; accountIds: string[] }[]> = {};

    handleConnection(socket: Socket) {
        const userId = this.getUserIdFromHandshake(socket);
        if (!userId) {
            socket.disconnect(true);
            return;
        }

        socket.join(userId);
        socket.emit('activeAccountPostDetailsUpdates', this.activePostDetailsUpdates[userId]);
        socket.emit('activeAccountAccountsUpdates', this.activeAccountsUpdates[userId]);
    }

    private getUserIdFromHandshake(socket: Socket): string | null {
        try {
            const token =
                this.extractTokenFromHandshakeAuth(socket) ??
                this.extractTokenFromAuthorizationHeader(socket) ??
                this.extractTokenFromCookies(socket);

            if (!token) return null;
            if (!process.env.JWT_SECRET) {
                this.logger.error('[SCRAPERS_SOCKET] JWT_SECRET is not set');
                return null;
            }

            const payload = jwt.verify(token, process.env.JWT_SECRET) as UserPayload | undefined;
            const userId = payload?._id;
            if (!userId) return null;

            return userId.toString();
        } catch (e) {
            this.logger.warn(`[SCRAPERS_SOCKET] Unauthorized connection: ${e instanceof Error ? e.message : String(e)}`);
            return null;
        }
    }

    private extractTokenFromHandshakeAuth(socket: Socket): string | null {
        const raw = (socket.handshake as any)?.auth?.token;
        if (!raw || typeof raw !== 'string') return null;
        return this.normalizeBearer(raw);
    }

    private extractTokenFromAuthorizationHeader(socket: Socket): string | null {
        const raw = socket.handshake?.headers?.authorization;
        if (!raw || typeof raw !== 'string') return null;
        return this.normalizeBearer(raw);
    }

    private extractTokenFromCookies(socket: Socket): string | null {
        const cookieHeader = socket.handshake?.headers?.cookie;
        if (!cookieHeader || typeof cookieHeader !== 'string') return null;

        // If you ever decide to set access token as a cookie, support it here.
        const cookieMap = Object.fromEntries(
            cookieHeader
                .split(';')
                .map(p => p.trim())
                .filter(Boolean)
                .map(kv => {
                    const idx = kv.indexOf('=');
                    if (idx === -1) return [kv, ''];
                    return [kv.slice(0, idx), decodeURIComponent(kv.slice(idx + 1))];
                }),
        );

        const token = cookieMap['accessToken'] || cookieMap['Authorization'];
        if (!token || typeof token !== 'string') return null;
        return this.normalizeBearer(token);
    }

    private normalizeBearer(raw: string): string {
        return raw.replace(/^Bearer\s+/i, '').trim();
    }

    /** Пользователь начал обновление постов */
    startAccountPostDetailsUpdate(userId: string, campaignId: string, accountIds: string[]) {
        if (!this.activePostDetailsUpdates[userId]) this.activePostDetailsUpdates[userId] = [];

        const existing = this.activePostDetailsUpdates[userId].find(u => u.campaignId === campaignId);
        if (existing) {
            existing.accountIds.push(...accountIds.filter(id => !existing.accountIds.includes(id)));
        } else {
            this.activePostDetailsUpdates[userId].push({ campaignId, accountIds });
        }

        this.broadcastActivePostDetailsUpdates(userId);
    }

    /** Пользователь закончил обновление постов */
    finishAccountPostDetailsUpdate(userId: string, campaignId: string, accountIds: string[]) {
        if (!this.activePostDetailsUpdates[userId]) return;

        const campaign = this.activePostDetailsUpdates[userId].find(u => u.campaignId === campaignId);
        if (campaign) {
            campaign.accountIds = campaign.accountIds.filter(id => !accountIds.includes(id));
            if (campaign.accountIds.length === 0) {
                this.activePostDetailsUpdates[userId] = this.activePostDetailsUpdates[userId].filter(u => u.campaignId !== campaignId);
            }
        }

        if (this.activePostDetailsUpdates[userId]?.length === 0) delete this.activePostDetailsUpdates[userId];

        this.broadcastActivePostDetailsUpdates(userId);
    }

    /** Пользователь начал обновление аккаунтов */
    startAccountAccountsUpdate(userId: string, socialMedia: string, accountIds: string[]) {
        if (!this.activeAccountsUpdates[userId]) this.activeAccountsUpdates[userId] = [];

        const existing = this.activeAccountsUpdates[userId].find(u => u.socialMedia === socialMedia);
        if (existing) {
            existing.accountIds.push(...accountIds.filter(id => !existing.accountIds.includes(id)));
        } else {
            this.activeAccountsUpdates[userId].push({ socialMedia, accountIds });
        }

        this.broadcastActiveAccountsUpdates(userId);
    }

    /** Пользователь закончил обновление аккаунтов */
    finishAccountAccountsUpdate(userId: string, socialMedia: string, accountIds: string[]) {
        if (!this.activeAccountsUpdates[userId]) return;

        const campaign = this.activeAccountsUpdates[userId].find(u => u.socialMedia === socialMedia);
        if (campaign) {
            campaign.accountIds = campaign.accountIds.filter(id => !accountIds.includes(id));
            if (campaign.accountIds.length === 0) {
                this.activeAccountsUpdates[userId] = this.activeAccountsUpdates[userId].filter(u => u.socialMedia !== socialMedia);
            }
        }

        if (this.activeAccountsUpdates[userId]?.length === 0) delete this.activeAccountsUpdates[userId];

        this.broadcastActiveAccountsUpdates(userId);
    }

    /** Рассылаем фронту актуальное состояние по обновлениям постов */
    private broadcastActivePostDetailsUpdates(userId: string) {
        this.server.to(userId).emit('activeAccountPostDetailsUpdates', this.activePostDetailsUpdates[userId] ?? []);
    }

    /** Рассылаем фронту актуальное состояние по обновлениям аккаунтов */
    private broadcastActiveAccountsUpdates(userId: string) {
        this.server.to(userId).emit('activeAccountAccountsUpdates', this.activeAccountsUpdates[userId] ?? []);
    }

    /** Статус обновления конкретного поста для конкретного аккаунта */
    refreshPostDetailsStatusUpdate(userId: string, data: any) {
        this.server.to(userId).emit('refreshPostDetailsStatusUpdate', data);
    }

    /** Статус обновления конкретного аккаунта */
    refreshAccountStatusUpdate(userId: string, data: any) {
        this.server.to(userId).emit('refreshAccountStatusUpdate', data);
    }

    /** Уведомление о завершении всего обновления кампании */
    notificationFinishedRefreshingPostDetails(userId: string, data: { campaignName: string; statusCode: number }) {
        this.server.to(userId).emit('notificationFinishedRefreshingPostDetails', data);
    }

    /** Уведомление о завершении обновления всех аккаунтов выбранной соц сети */
    notificationFinishedRefreshingAccounts(userId: string, data: { socialMedia: string; statusCode: number }) {
        this.server.to(userId).emit('notificationFinishedRefreshingAccounts', data);
    }

    getActivePostDetailsUpdates() {
        return this.activePostDetailsUpdates;
    }
    getActiveAccountsDetailsUpdates() {
        return this.activeAccountsUpdates;
    }
}
