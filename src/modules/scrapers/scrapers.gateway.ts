import { Injectable } from '@nestjs/common';
import { RealtimeNotificationService } from '../websocket/realtime-notification.service';

export type ScrapersRealtimeTarget = {
    userId?: string;
    sessionId?: string;
    clientId?: string;
};

@Injectable()
export class ScrapersGateway {
    /** список пользователей, рефрешащих посты в кампаниях */
    private activePostDetailsUpdates: Record<string, { campaignId: string; accountIds: string[] }[]> = {};
    private activeAccountsUpdates: Record<string, { socialMedia: string; accountIds: string[] }[]> = {};

    constructor(private readonly realtimeNotificationService: RealtimeNotificationService) {}

    /** Пользователь начал обновление постов */
    startAccountPostDetailsUpdate(target: ScrapersRealtimeTarget, campaignId: string, accountIds: string[]) {
        const targetKey = this.getTargetKey(target);
        if (!targetKey) return;

        if (!this.activePostDetailsUpdates[targetKey]) this.activePostDetailsUpdates[targetKey] = [];

        const existing = this.activePostDetailsUpdates[targetKey].find(u => u.campaignId === campaignId);
        if (existing) {
            existing.accountIds.push(...accountIds.filter(id => !existing.accountIds.includes(id)));
        } else {
            this.activePostDetailsUpdates[targetKey].push({ campaignId, accountIds });
        }

        this.broadcastActivePostDetailsUpdates(target);
    }

    /** Пользователь закончил обновление постов */
    finishAccountPostDetailsUpdate(target: ScrapersRealtimeTarget, campaignId: string, accountIds: string[]) {
        const targetKey = this.getTargetKey(target);
        if (!targetKey || !this.activePostDetailsUpdates[targetKey]) return;

        const campaign = this.activePostDetailsUpdates[targetKey].find(u => u.campaignId === campaignId);
        if (campaign) {
            campaign.accountIds = campaign.accountIds.filter(id => !accountIds.includes(id));
            if (campaign.accountIds.length === 0) {
                this.activePostDetailsUpdates[targetKey] = this.activePostDetailsUpdates[targetKey].filter(u => u.campaignId !== campaignId);
            }
        }

        if (this.activePostDetailsUpdates[targetKey]?.length === 0) delete this.activePostDetailsUpdates[targetKey];

        this.broadcastActivePostDetailsUpdates(target);
    }

    /** Пользователь начал обновление аккаунтов */
    startAccountAccountsUpdate(target: ScrapersRealtimeTarget, socialMedia: string, accountIds: string[]) {
        const targetKey = this.getTargetKey(target);
        if (!targetKey) return;

        if (!this.activeAccountsUpdates[targetKey]) this.activeAccountsUpdates[targetKey] = [];

        const existing = this.activeAccountsUpdates[targetKey].find(u => u.socialMedia === socialMedia);
        if (existing) {
            existing.accountIds.push(...accountIds.filter(id => !existing.accountIds.includes(id)));
        } else {
            this.activeAccountsUpdates[targetKey].push({ socialMedia, accountIds });
        }

        this.broadcastActiveAccountsUpdates(target);
    }

    /** Пользователь закончил обновление аккаунтов */
    finishAccountAccountsUpdate(target: ScrapersRealtimeTarget, socialMedia: string, accountIds: string[]) {
        const targetKey = this.getTargetKey(target);
        if (!targetKey || !this.activeAccountsUpdates[targetKey]) return;

        const campaign = this.activeAccountsUpdates[targetKey].find(u => u.socialMedia === socialMedia);
        if (campaign) {
            campaign.accountIds = campaign.accountIds.filter(id => !accountIds.includes(id));
            if (campaign.accountIds.length === 0) {
                this.activeAccountsUpdates[targetKey] = this.activeAccountsUpdates[targetKey].filter(u => u.socialMedia !== socialMedia);
            }
        }

        if (this.activeAccountsUpdates[targetKey]?.length === 0) delete this.activeAccountsUpdates[targetKey];

        this.broadcastActiveAccountsUpdates(target);
    }

    /** Рассылаем фронту актуальное состояние по обновлениям постов */
    private broadcastActivePostDetailsUpdates(target: ScrapersRealtimeTarget) {
        const targetKey = this.getTargetKey(target);
        if (!targetKey) return;

        this.emit(target, 'activeAccountPostDetailsUpdates', this.activePostDetailsUpdates[targetKey] ?? []);
    }

    /** Рассылаем фронту актуальное состояние по обновлениям аккаунтов */
    private broadcastActiveAccountsUpdates(target: ScrapersRealtimeTarget) {
        const targetKey = this.getTargetKey(target);
        if (!targetKey) return;

        this.emit(target, 'activeAccountAccountsUpdates', this.activeAccountsUpdates[targetKey] ?? []);
    }

    /** Статус обновления конкретного поста для конкретного аккаунта */
    refreshPostDetailsStatusUpdate(target: ScrapersRealtimeTarget, data: any) {
        this.emit(target, 'refreshPostDetailsStatusUpdate', data);
    }

    /** Статус обновления конкретного аккаунта */
    refreshAccountStatusUpdate(target: ScrapersRealtimeTarget, data: any) {
        this.emit(target, 'refreshAccountStatusUpdate', data);
    }

    /** Уведомление о завершении всего обновления кампании */
    notificationFinishedRefreshingPostDetails(target: ScrapersRealtimeTarget, data: { campaignName: string; statusCode: number }) {
        this.emit(target, 'notificationFinishedRefreshingPostDetails', data);
    }

    /** Уведомление о завершении обновления всех аккаунтов выбранной соц сети */
    notificationFinishedRefreshingAccounts(target: ScrapersRealtimeTarget, data: { socialMedia: string; statusCode: number }) {
        this.emit(target, 'notificationFinishedRefreshingAccounts', data);
    }

    getActivePostDetailsUpdates() {
        return this.activePostDetailsUpdates;
    }
    getActiveAccountsDetailsUpdates() {
        return this.activeAccountsUpdates;
    }

    private emit(target: ScrapersRealtimeTarget, event: string, payload: unknown): void {
        if (target.sessionId && target.clientId) {
            this.realtimeNotificationService.emitToClient(target.sessionId, target.clientId, event, payload);
            return;
        }

        if (target.sessionId) {
            this.realtimeNotificationService.emitToSession(target.sessionId, event, payload);
            return;
        }

        if (target.userId) {
            this.realtimeNotificationService.emitToUser(target.userId, event, payload);
        }
    }

    private getTargetKey(target: ScrapersRealtimeTarget): string | null {
        if (target.sessionId && target.clientId) {
            return `client:${target.sessionId}:${target.clientId}`;
        }

        if (target.sessionId) {
            return `session:${target.sessionId}`;
        }

        if (target.userId) {
            return `user:${target.userId}`;
        }

        return null;
    }
}
