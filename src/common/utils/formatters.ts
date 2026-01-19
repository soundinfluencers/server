// Из типа Date в string 'DD.MM.YY'

import {CampaignStatusEnum} from "../types/client/campaign.types";

export const formatDate = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);

    return `${day}.${month}.${year}`;
};

export const formatClientCampaignStatus = (status: string): CampaignStatusEnum => {
    switch (status) {
        case 'wait':
            return CampaignStatusEnum.pending;
        case 'pending':
            return CampaignStatusEnum.pending;
        case 'work':
            return CampaignStatusEnum.distributing;
        case 'distributing':
            return CampaignStatusEnum.distributing;
        case 'finally':
            return CampaignStatusEnum.completed;
        case 'completed':
            return CampaignStatusEnum.completed;
        default:
            return CampaignStatusEnum.pending;
    }
}