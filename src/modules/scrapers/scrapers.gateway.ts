import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import {Server, Socket} from 'socket.io';
import { Injectable } from '@nestjs/common';

@Injectable()
@WebSocketGateway({  path: '/scrapers-socket.io' })
export class ScrapersGateway {
    @WebSocketServer()
    server: Server;

    /** список пользователей, рефрешащих посты в кампаниях */
    private activePostDetailsUpdates: Record<string, { campaignId: string; accountIds: string[] }[]> = {};
    private activeAccountsUpdates: Record<string, { socialMedia: string; accountIds: string[] }[]> = {};

    handleConnection(socket: Socket) {
        const userId = socket.handshake.auth.userId;

        socket.join(userId);
        socket.emit('activeAccountPostDetailsUpdates', this.activePostDetailsUpdates[userId]);
        socket.emit('activeAccountAccountsUpdates', this.activeAccountsUpdates[userId]);
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
        this.server.emit('activeAccountPostDetailsUpdates', this.activePostDetailsUpdates[userId] ?? []);
    }

    /** Рассылаем фронту актуальное состояние по обновлениям аккаунтов */
    private broadcastActiveAccountsUpdates(userId: string) {
        this.server.emit('activeAccountAccountsUpdates', this.activeAccountsUpdates[userId] ?? []);
    }

    /** Статус обновления конкретного поста для конкретного аккаунта */
    refreshPostDetailsStatusUpdate(userId: string, data: any) {
        this.server.emit('refreshPostDetailsStatusUpdate', data);
    }

    /** Статус обновления конкретного аккаунта */
    refreshAccountStatusUpdate(userId: string, data: any) {
        this.server.emit('refreshAccountStatusUpdate', data);
    }

    /** Уведомление о завершении всего обновления кампании */
    notificationFinishedRefreshingPostDetails(userId: string, data: { campaignName: string; statusCode: number }) {
        this.server.emit('notificationFinishedRefreshingPostDetails', data);
    }

    /** Уведомление о завершении обновления всех аккаунтов выбранной соц сети */
    notificationFinishedRefreshingAccounts(userId: string, data: { socialMedia: string; statusCode: number }) {
        this.server.emit('notificationFinishedRefreshingAccounts', data);
    }

    getActivePostDetailsUpdates() {
        return this.activePostDetailsUpdates;
    }
    getActiveAccountsDetailsUpdates() {
        return this.activeAccountsUpdates;
    }
}
