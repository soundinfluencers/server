import {SocialMediaEnum, SocialMediaType} from "../social-media.types";
import {Types} from "mongoose";
import {InfluencerConfirmationStatusEnum, InfluencerPromoClosedStatusEnum} from "../influencer/promo.types";
import {CampaignContentMediaCache} from "../../../database/schemas/campaign/campaign.schema";
import {Role} from "../user.types";
import {AdminCampaignsListStatusEnum} from "../../../modules/admin/dto/campaigns/admin-campaigns.dto";
import {CurrencyCode} from "../finance.types";

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
    draft = 'draft',
    declined = 'declined',
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

// last saved step of creating campaign
export enum CampaignDraftLatestStep {
    addAccounts = 'addAccounts',
    addContent = 'addContent',
    strategyTable = 'strategyTable',
}

// Dashboard campaign read model
export interface IDashboardCampaign {
    _id: Types.ObjectId;
    campaignName: string;
    socialMedia: SocialMediaType | 'multipromo';
    createdAt: Date;
    clientStatus: string;
    price?: number;
    latestStep?: CampaignDraftLatestStep;
}

export interface ISelectedContent {
    campaignContentItemId: Types.ObjectId;
    descriptionId?: Types.ObjectId;
}

// full campaign content item
export interface ICampaignContent {
    _id: Types.ObjectId;
    socialMedia: SocialMediaEnum;
    socialMediaGroup: string;
    mainLink: string;
    mediaCache?: CampaignContentMediaCache;
    descriptions?: {
        _id: Types.ObjectId;
        description: string;
    }[];
    taggedUser?: string;
    taggedLink?: string;
    additionalBrief?: string;
}

// full campaign content item but with selected description
export interface IDetailedSelectedContent {
    _id: Types.ObjectId;
    socialMedia: SocialMediaEnum;
    socialMediaGroup: string;
    mainLink: string;
    description: string;
    taggedUser?: string;
    taggedLink?: string;
    additionalBrief?: string;
}

// Read model for campaign added account
export interface ICampaignAccount {
    addedAccountsId: Types.ObjectId;
    socialAccountId: Types.ObjectId;
    influencerId: Types.ObjectId;
    socialMedia: SocialMediaEnum;
    logoUrl?: string;
    username: string;
    // price: number
    publicPrice: number;
    followers: number;
    selectedContent: ISelectedContent;
    selectedContentItem?: IDetailedSelectedContent | null;
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

// Read model for campaign added account (ADMIN)
export interface IAdminCampaignAccount extends ICampaignAccount {
    cpm: number;
}

// Read model for campaign details
export interface ICampaignDetails {
    _id: Types.ObjectId;
    campaignName: string;
    socialMedia: SocialMediaType | 'multipromo';
    createdAt: Date;
    price: number;
    displayCurrency: CurrencyCode;
    status: CampaignStatusEnum;
    addedAccounts: ICampaignAccount[];
    campaignContent: ICampaignContent[];
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

export interface IPublicCampaignForTable {
    campaignId: string;
    // clientId: string;
    price: number;
    campaignName: string;
    socialMedia: SocialMediaType | 'multipromo';
    creationDate: string;
    status: CampaignStatusEnum;

    // TODO: interface for campaign's added accounts
    addedAccounts: any[];
    campaignContent: ICampaignContent[];

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

// Interface for base proposal campaign information
export interface IProposalCampaign {
    _id: Types.ObjectId;
    campaignName: string;
    socialMedia: SocialMediaEnum;
    optionIds: Types.ObjectId[];
}

// Interface for selected proposal campaign option
export interface IProposalOption {
    _id: Types.ObjectId;
    proposalCampaignId: Types.ObjectId;
    publicCampaignPrice: number; // show users
    privateCampaignPrice: number; // show us
    addedAccounts: ICampaignAccount[];
    campaignContent: ICampaignContent[];
}

// Enum with admin campaigns list statuses
export enum AdminCampaignStatusEnum {
    underReview = 'under_review',
    pending = 'pending',
    distributing = 'distributing',
    completed = 'completed',
    declined = 'declined',
    proposal = 'proposal',
}

// Enum with campaign's admin meta fields
export enum CampaignAdminMetaEnum {
    reportSent = 'reportSent',
    notes = 'notes',
    affiliatePartner = 'affiliatePartner',
    affiliateCommission = 'affiliateCommission',
    affiliatePaid = 'affiliatePaid',
}

// Interface for campaign from admin campaigns list
export interface IAdminCampaignForList {
    _id: Types.ObjectId;
    socialMedia: SocialMediaType | 'multipromo';
    campaignName: string;
    creatorRole: Role;
    creatorName: string;
    totalFollowers: number;
    price: number;
    publicPrice: number;
    createdAt: Date;
    status: AdminCampaignsListStatusEnum;
    statusLabel: AdminCampaignStatusEnum;
    reportSent: boolean;
    paymentStatus: CampaignPaymentStatusEnum;
    invoiceId: Types.ObjectId; // _id of invoice that connected to this campaign
    shortInvoiceNumber: number;
    notes?: string; // notes for this campaign
    affiliatePartner?: string; // input for admin
    affiliateCommission?: string; // input for admin
    affiliatePaid?: string; // input for admin
}

// Read model for admin campaign details page
export interface IAdminCampaignDetails extends ICampaignDetails {
    addedAccounts: IAdminCampaignAccount[];
}