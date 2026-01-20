import { SocialMediaType } from "../social-media.types";
import { CampaignStatusEnum } from "../client/campaign.types";

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
    close = 'close',
    wait = 'wait',
}

// enum of statuses for filtering influencer dashboard promos
export enum InfluencerDashboardPromoStatus {
    ongoing = 'ongoing',
    close = 'close',
    new = 'new',
    all = 'all',
}

// base for other promo interfaces
export interface InfluencerPromoBase {
    // id of campaign
    campaignId: string;

    // id of influencer's account
    influencerId: string;

    // id of object in addedAccounts
    addedAccountsId: string;

    // id of influencer's social account (can be undefined in case of old schema didn't contain this field)
    socialAccountId?: string;

    // campaignName
    campaignName: string;

    // social account's username
    username: string;

    // social media of social account
    accountSocialMedia: SocialMediaType;

    // date when promo was requested
    createdAt: string;

    // Client's name or company name
    // client?: string;

    // statuses
    // statusCampaign: CampaignStatusEnum;
    // closedStatus: InfluencerPromoClosedStatusType;
    // confirmation: InfluencerConfirmationStatusType;

    // promo's info
    // dateRequest: string | Date;
    // mainLink: string;
    // description: string;
    // taggedUser?: string;
    // taggedLink?: string;
    // additionalBrief?: string;
}

// promo object for showing in new promo requests
export interface InfluencerNewPromoRequest extends InfluencerPromoBase {
    // Client's name or company name
    clientName: string;

    // promo's info
    dateRequest: string;
    mainLink: string;
    description?: string;
    taggedUser?: string;
    taggedLink?: string;
    additionalBrief?: string;
}

// promo object for showing in dashboard
export interface InfluencerDashboardPromo extends InfluencerPromoBase {
    // statuses
    statusCampaign: CampaignStatusEnum;
    closedStatus: InfluencerPromoClosedStatusType;
    confirmation: InfluencerConfirmationStatusType;
}

// promo object for showing in completed promos list
export interface InfluencerCompletedPromo extends InfluencerPromoBase {
    // Client's name or company name
    clientName: string;
    // reward for influencer for completing promo (default price, not publicPrice)
    reward: number;
    // link for created post
    postLink: string;
}

// promo object with all details
export interface InfluencerDetailedPromo extends InfluencerPromoBase {
    // Client's name or company name
    clientName: string;

    // reward for influencer for completing promo (default price, not publicPrice)
    reward: number;

    // link for created post (can be undefined in case of ongoing/not completed promo)
    postLink?: string;

    // promo's info
    dateRequest: string;
    mainLink: string;
    description?: string;
    taggedUser?: string;
    taggedLink?: string;
    additionalBrief?: string;

    // statuses
    statusCampaign: CampaignStatusEnum;
    closedStatus: InfluencerPromoClosedStatusType;
    confirmation: InfluencerConfirmationStatusType;
}

// interface for updating promo's post details
export interface InfluencerUpdatedPostDetails {
    postLink?: string;
    screenshotUrl?: string;
    impressions?: number;
    like?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    rating?: number;
}