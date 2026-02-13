import {SocialMediaEnum, SocialMediaType} from "../social-media.types";
import {ApiProperty} from "@nestjs/swagger";
import {Types} from "mongoose";
import {InfluencerConfirmationStatusEnum, InfluencerPromoClosedStatusEnum} from "../influencer/promo.types";
import {CampaignContentMediaCache} from "../../../database/schemas/campaign/campaign.schema";

// Campaign verify status
export enum CampaignConfirmationEnum {
    wait = 'wait',
    accept = 'accept',
    decline = 'decline',
}

// Campaign payment status
export enum CampaignPaymentStatusEnum {
    wait = 'wait',
    confirmed = 'confirmed',
}

// Campaign type enum for getting correct campaigns
export enum CampaignTypeEnumForDevelopment {
    draft = 'draft',
    underReview = 'under_review',
    distributing = 'distributing',
    closed = 'closed',
    proposal = 'proposal',
    all = 'all'
}

// campaign progress status enum
export enum CampaignStatusEnum {
    underReview = 'under_review',
    pending = 'pending',
    distributing = 'distributing',
    completed = 'completed',
    draft = 'draft'
}

// Enum for bespoke campaign request type
export enum BespokeRequestCategory {
    artist = 'artist',
    music = 'music',
    event = 'event',
    other = 'other',
}

export enum CampaignPaymentMethodEnum {
    bankCard = 'bank_card',
    paypal = 'paypal',
    bankTransferUk = 'bank_transfer_uk',
    bankTransferEu = 'bank_transfer_eu',
    bankTransferInternational = 'bank_transfer_international',
    crypto = 'crypto',
}

// selected payment method for emails, messages
export const CampaignPaymentLabels: Record<CampaignPaymentMethodEnum, string> = {
    [CampaignPaymentMethodEnum.bankCard]: 'Bank card',
    [CampaignPaymentMethodEnum.bankTransferInternational]: 'International transfer',
    [CampaignPaymentMethodEnum.bankTransferEu]: 'EU transfer',
    [CampaignPaymentMethodEnum.bankTransferUk]: 'UK transfer',
    [CampaignPaymentMethodEnum.paypal]: 'PayPal',
    [CampaignPaymentMethodEnum.crypto]: 'Crypto',
};

// Using at home page
export interface ClientGetCampaignForList {
    _id: string;
    campaignName: string;
    socialMedia: SocialMediaType | 'multipromo';
    creationDate: string;
    price?: number;
    status?: CampaignStatusEnum | 'draft' | 'proposal';
}

export class SafeSelectedContent {
    campaignContentItemId: string | Types.ObjectId;
    descriptionId?: string | Types.ObjectId;
}

// full campaign content item
export class SafeCampaignContent {
    _id: string | Types.ObjectId;
    socialMedia: SocialMediaEnum;
    socialMediaGroup: string;
    mainLink: string;
    mediaCache?: CampaignContentMediaCache;
    descriptions?: {
        _id: string | Types.ObjectId;
        description: string;
    }[];
    taggedUser?: string;
    taggedLink?: string;
    additionalBrief?: string;
}

// full campaign content item but with selected description
export class SafeSelectedContentItem {
    _id: string | Types.ObjectId;
    socialMedia: SocialMediaEnum;
    socialMediaGroup: string;
    mainLink: string;
    description: string;
    taggedUser?: string;
    taggedLink?: string;
    additionalBrief?: string;
}

export class SafeCampaignAccount {
    addedAccountsId: string | Types.ObjectId;
    socialAccountId: string | Types.ObjectId;
    influencerId: string | Types.ObjectId;
    socialMedia: SocialMediaEnum;
    username: string;
    // price: number
    publicPrice: number;
    followers: number;
    selectedContent: SafeSelectedContent;
    selectedContentItem?: SafeSelectedContentItem | null;
    confirmation: InfluencerConfirmationStatusEnum;
    closePromo: InfluencerPromoClosedStatusEnum;
    dateRequest?: string;
    datePost?: string;
    postLink?: string;
    screenshot?: string;
    impressions?: number;
    like?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    rating?: number;
    genres?: string[];
    countries?: object[];
}

// Used by campaign report page
export interface ClientCampaignForTable {
    campaignId: string;
    campaignName: string;
    socialMedia: SocialMediaType | 'multipromo';
    creationDate: string;
    price: number;
    status: CampaignStatusEnum;

    addedAccounts: SafeCampaignAccount[];

    campaignContent: SafeCampaignContent[];

    shareLink: string;

    totalFollowers: number;
    totalImpressions: number;
    totalLikes: number;
    totalSaves: number;
    totalComments: number;
    totalShares: number;

    isCpmAndResultHidden: boolean;
    cpm?: number | null;
    isPriceHidden: boolean;
    hiddenColumns?: string[];
    canEdit?: boolean;
}

export interface PublicCampaignForTable {
    campaignId: string;
    // clientId: string;
    price: number;
    campaignName: string;
    socialMedia: SocialMediaType | 'multipromo';
    creationDate: string;
    status: CampaignStatusEnum;

    // TODO: interface for campaign's added accounts
    addedAccounts: any[];
    campaignContent: SafeCampaignContent[];

    shareLink: string;

    totalFollowers: number;
    totalLikes: number;
    totalImpressions: number;
    totalSaves: number;
    totalComments: number;
    totalShares: number;

    isCpmAndResultHidden: boolean;
    isPriceHidden: boolean;

    hiddenColumns?: string[];
    cpm?: number | null;
}