import {
    InfluencerCountryStats,
    InfluencerMusicGenre,
    UserNotificationMethods
} from "../../../database/schemas/users/influencer.schema";
import {InfluencerConfirmationStatusEnum} from "./promo.types";
import {AccountVerifiedStatus} from "../user.types";
import {CurrencyCode} from "../finance.types";
import {SocialMediaEnum} from "../social-media.types";

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
}

// record for influencer's history campaign action status
export const HistoryCampaignActionStatusLabel: Record<
    HistoryCampaignActionStatus,
    string
> = {
    [HistoryCampaignActionStatus.pending]: 'Pending',
    [HistoryCampaignActionStatus.inDistribution]: 'In Distribution',
    [HistoryCampaignActionStatus.insightsSubmitted]: 'Insights Submitted',
    [HistoryCampaignActionStatus.invoiceSubmitted]: 'Invoice Submitted',
    [HistoryCampaignActionStatus.paid]: 'Paid',
    [HistoryCampaignActionStatus.denied]: 'Denied',
    [HistoryCampaignActionStatus.addedByAdmin]: "Added By Admin",
};

export interface ShortSocialAccountInfo {
    accountId: string;
    socialMedia: SocialMediaEnum;
    username: string;
    price: number;
}