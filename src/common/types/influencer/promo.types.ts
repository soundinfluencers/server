import {SocialMediaType} from "../social-media.types";
import {CampaignStatusType} from "../client/campaign.types";

export interface InfluencerPromoRequest {
    // id of campaign
    campaignId: string;

    // id of influencer's account
    influencerId: string;

    // id of influencer's social account
    selectInfluencersId: string;

    // Client's name or company name
    client?: string;
    campaignName: string;
    socialMediaUsername: string;

    // social media of social account
    socialMedia: SocialMediaType;
    dateRequest: string | Date;
    createdAt: string | Date;

    // promo's info
    videoLink: string;
    postDescription: string;
    storyTag?: string;
    storyLink?: string;
    additionalBrief?: string;
}

// type and enum for influencer's response to new promo request
export type InfluencerConfirmationStatusType = 'accept' | 'reject' | 'wait';
export enum InfluencerConfirmationStatusEnum {
    accept = 'accept',
    reject = 'reject',
    wait = 'wait',
}

// type and enum for influencer's closed status
export type InfluencerPromoClosedStatusType = 'closed' | 'wait';
export enum InfluencerPromoClosedStatusEnum {
    closed = 'closed',
    wait = 'wait',
}

export interface InfluencerPromo extends InfluencerPromoRequest {
    statusCampaign: CampaignStatusType;
    closedStatus: InfluencerPromoClosedStatusType;
    confirmation: InfluencerConfirmationStatusType;
}