import {CampaignAction} from "../../../database/schemas/histories/influencer-actions-history.schema";
import {SocialMediaEnum} from "../../../common/types/social-media.types";

export class CampaignActionWithCampaignMeta extends CampaignAction {
    campaignId: string;
    campaignName: string;
}

export interface ProcessedInfluencerHistory {
    influencerId: string;
    influencerEmail: string;
    influencerName: string;

    // influencer's social accounts small data array
    accountsUsernames: {
        // id of social account
        accountId: string;
        socialMedia: SocialMediaEnum;
        username: string;
        publicPrice: number | string;
    }[];

    // currency note for this influencer
    currencyNote: string;

    // history with all actions
    history: any[];
}