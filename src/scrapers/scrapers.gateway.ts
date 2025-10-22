import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import {Server, Socket} from 'socket.io';
import { Injectable } from '@nestjs/common';

@Injectable()
@WebSocketGateway({  path: '/scrapers-socket.io' })
export class ScrapersGateway {
    @WebSocketServer()
    server: Server;

    /** список пользователей, рефрешащих аккаунты */
    private activeUpdates: Record<string, { campaignId: string; accountIds: string[] }[]> = {};

    handleConnection(socket: Socket) {
        const userId = socket.handshake.auth.userId;

        socket.join(userId);
        socket.emit('activeScraperUpdates', this.activeUpdates[userId]);
    }

    /** Пользователь начал обновление аккаунтов */
    startAccountUpdate(userId: string, campaignId: string, accountIds: string[]) {
        if (!this.activeUpdates[userId]) this.activeUpdates[userId] = [];

        const existing = this.activeUpdates[userId].find(u => u.campaignId === campaignId);
        if (existing) {
            existing.accountIds.push(...accountIds.filter(id => !existing.accountIds.includes(id)));
        } else {
            this.activeUpdates[userId].push({ campaignId, accountIds });
        }

        this.broadcastActiveUpdates(userId);
    }

    /** Пользователь закончил обновление аккаунтов */
    finishAccountUpdate(userId: string, campaignId: string, accountIds: string[]) {
        if (!this.activeUpdates[userId]) return;

        const campaign = this.activeUpdates[userId].find(u => u.campaignId === campaignId);
        if (campaign) {
            campaign.accountIds = campaign.accountIds.filter(id => !accountIds.includes(id));
            if (campaign.accountIds.length === 0) {
                this.activeUpdates[userId] = this.activeUpdates[userId].filter(u => u.campaignId !== campaignId);
            }
        }

        if (this.activeUpdates[userId]?.length === 0) delete this.activeUpdates[userId];

        this.broadcastActiveUpdates(userId);
    }

    /** Рассылаем фронту актуальное состояние */
    private broadcastActiveUpdates(userId: string) {
        this.server.emit('activeAccountUpdates', this.activeUpdates[userId] ?? []);
    }

    /** Статус конкретного аккаунта */
    refreshPostDetailsStatusUpdate(userId: string, data: any) {
        this.server.emit('refreshPostDetailsStatusUpdate', data);
    }

    /** Уведомление о завершении всего обновления кампании */
    notificationFinishedRefreshingPostDetails(userId: string, data: { campaignName: string; statusCode: number }) {
        this.server.emit('notificationFinishedRefreshingPostDetails', data);
    }

    /** Уведомление о завершении обновления всех аккаунтов выбранной соц сети */
    notificationFinishedRefreshingAccounts(userId: string, data: { socialMedia: string; statusCode: number }) {
        this.server.emit('notificationFinishedRefreshingPostDetails', data);
    }

    getActiveUpdates() {
        return this.activeUpdates;
    }
}
