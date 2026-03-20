import {CampaignPaymentLabels, CampaignPaymentMethodEnum, CampaignStatusEnum} from "../types/client/campaign.types";

// Из типа Date в string 'DD.MM.YY'
export const formatDate = (date: Date, separator: string = '.'): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);

    return `${day}${separator}${month}${separator}${year}`;
};

// Из типа Date в string 'DD.MM.YY 00:00'
export function formatDateTime(date: Date): string {
    const d = new Date(date);

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();

    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");

    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

export const formatClientCampaignStatus = (status: string): CampaignStatusEnum => {
    switch (status) {
        case 'wait':
            return CampaignStatusEnum.pending;
        case 'under_review':
            return CampaignStatusEnum.underReview;
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

// format for emails, messages
export const formatCampaignPaymentType = (type: CampaignPaymentMethodEnum) => CampaignPaymentLabels[type];