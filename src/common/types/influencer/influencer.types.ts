import {
    InfluencerCountryStats,
    InfluencerMusicGenre,
    UserNotificationMethods
} from "../../../database/schemas/users/influencer.schema";
import {CurrencyCode} from "../finance.types";
import {SocialMediaEnum} from "../social-media.types";
import {ObjId} from "../base.types";

export enum InfluencerProfileCategory {
    community = 'community',
    creator = 'creator'
}

export enum SocialAccountLabelStatus {
    accept = 'accept',
    decline = 'decline',
    waitForAdmin = 'waitForAdmin',
    waitForUser = 'waitForUser',
    negotiation = 'negotiation',
    priceChanged = 'priceChanged',
}

export enum AgreementType {
    profileCreate = 'profileCreate',
    accountAdd = 'accountAdd',
}

export interface SocialAccountForAccountDetails {
    accountId: string;
    username: string;
    labelStatus: SocialAccountLabelStatus;
}

// interface for account settings page
export interface InfluencerAccountDetails {
    firstName: string;
    email: string;
    phone: string;
    notificationMethods: UserNotificationMethods;

    instagram: SocialAccountForAccountDetails[];
    tiktok: SocialAccountForAccountDetails[];
    spotify: SocialAccountForAccountDetails[];
    youtube: SocialAccountForAccountDetails[];
    facebook: SocialAccountForAccountDetails[];
    soundcloud: SocialAccountForAccountDetails[];
    press: SocialAccountForAccountDetails[];

    lastName?: string;
    telegramUsername?: string;
    logoUrl?: string;
}

export interface SocialAccountDetails {
    accountId: string;
    username: string;
    profileLink: string;
    followers: number;
    logoUrl: string;
    profileCategory: InfluencerProfileCategory;
    initialPrice: number;
    currency: CurrencyCode;
    musicGenres: InfluencerMusicGenre[];
    creatorCategories: string[];
    countries: InfluencerCountryStats[];
    categories: string[];
    engagementRate: number;
    averageViews: number;
}

export enum SocialAccountSortByEnum {
    bestMatch = 'bestMatch',
    lowestPrice = 'lowestPrice',
    highestPrice = 'highestPrice',
    lowestFollowers = 'lowestFollowers',
    highestFollowers = 'highestFollowers',
}

// enum for influencer's history campaign action status
export enum HistoryCampaignActionStatus {
    pending = 0, // influencer got new promo (can accept/deny)
    inDistribution = 1, // influencer accepted this promo request (can post & submit insights)
    insightsSubmitted = 2, // influencer submitted insights (can create invoice for this promo)
    invoiceSubmitted = 3, // influencer submitted invoice for this promo and waiting for payment
    paid = 4, // influencer got payment
    denied = 5, // influencer denied this promo request
    addedByAdmin = 6, // Admin added social account to campaign
    insightsSubmittedByAdmin = 7, // Admin submitted insights and sent money for this promo
}

// record for influencer's history campaign action status
export const HistoryCampaignActionStatusLabel: Record<
    HistoryCampaignActionStatus,
    string
> = {
    [HistoryCampaignActionStatus.pending]: 'Campaign Pending Approval',
    [HistoryCampaignActionStatus.inDistribution]: 'Campaign Accepted',
    [HistoryCampaignActionStatus.insightsSubmitted]: 'Insights Submitted',
    [HistoryCampaignActionStatus.invoiceSubmitted]: 'Invoice Submitted',
    [HistoryCampaignActionStatus.paid]: 'Paid',
    [HistoryCampaignActionStatus.denied]: 'Campaign Declined',
    [HistoryCampaignActionStatus.addedByAdmin]: "Added By Admin",
    [HistoryCampaignActionStatus.insightsSubmittedByAdmin]: "Insights Submitted By Admin",
};

export interface ShortSocialAccountInfo {
    accountId: string;
    socialMedia: SocialMediaEnum;
    username: string;
    price: number;
}

// Read model for admin list
export interface AdminInfluencerListItem {
    influencerId: ObjId; // influencer's _id
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string;
    balance: number;
    accountId: ObjId; // social account's _id
    username: string; // social account's username
    socialMedia: SocialMediaEnum;
    logoUrl: string;
    followers: number;
    profileLink: string;
    publicPrice: number; // show to clients
    price: number; // real price. real price = initial price * exchange rate
    initialPrice: number; // price that was chosen by account's owner
    currency: CurrencyCode; // currency that was chosen by account's owner
    costPerFollower: number;
    isHidden: boolean;
    internalNote?: string;
}