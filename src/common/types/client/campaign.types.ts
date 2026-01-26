import {SocialMediaEnum, SocialMediaType} from "../social-media.types";
import {ApiProperty} from "@nestjs/swagger";
import {Types} from "mongoose";

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

// Verified campaign progress status enum
export enum CampaignStatusEnum {
    underReview = 'under_review',
    pending = 'pending',
    distributing = 'distributing',
    completed = 'completed',
    draft = 'draft'
}

// Enum for selected payment method
export enum CampaignPaymentMethodEnum {
    bankCard = 'bank_card',
    paypal = 'paypal',
    bankTransferUk = 'bank_transfer_uk',
    bankTransferEu = 'bank_transfer_eu',
    bankTransferInternational = 'bank_transfer_international',
    crypto = 'crypto',
}

// Using at home page
export interface ClientGetCampaignForList {
    _id: string;
    campaignName: string;
    socialMedia: SocialMediaType | 'multipromo';
    creationDate: string;
    price?: number;
    status?: CampaignStatusEnum | 'draft';
}

export class SafeSelectedContent {
    campaignContentItemId: string | Types.ObjectId;
    descriptionId?: string | Types.ObjectId;
}

export class SafeCampaignContent {
    _id: string | Types.ObjectId;
    socialMedia: SocialMediaEnum;
    socialMediaGroup: string;
    mainLink: string;
    descriptions?: {
        _id: string | Types.ObjectId;
        description: string;
    }[];
    taggedUser?: string;
    taggedLink?: string;
    additionalBrief?: string;
}

// Used by campaign report page
export interface ClientCampaignForTable {
    campaignId: string;
    campaignName: string;
    socialMedia: SocialMediaType | 'multipromo';
    creationDate: string;
    price: number;
    status: CampaignStatusEnum;

    // TODO: interface for campaign's added accounts
    addedAccounts: any[];

    campaignContent: SafeCampaignContent[];

    shareLink: string;

    totalFollowers: number;
    totalImpressions: number;
    totalLikes: number;
    totalSaves: number;
    totalComments: number;
    totalShares: number;

    isCpmAndResultHidden: boolean;
    isPriceHidden: boolean;

    hiddenColumns?: string[];
    cpm?: number | null;
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
    cpm?: number;
}