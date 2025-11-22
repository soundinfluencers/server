// Из типа Date в string 'DD.MM.YY'
import {CampaignStatusType} from "../types/client/campaign.types";

export const formatDate = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);

    return `${day}.${month}.${year}`;
};

export const formatClientCampaignStatus = (status: string): CampaignStatusType => {
    switch (status) {
        case 'wait':
            return 'Pending';
        case 'work':
            return 'Distributing';
        case 'finally':
            return 'Completed';
        default:
            return 'Pending';
    }
}