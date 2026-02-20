import {
    InfluencerCountryStats,
    InfluencerMusicGenre,
    UserNotificationMethods
} from "../../../database/schemas/users/influencer.schema";
import {InfluencerConfirmationStatusEnum} from "./promo.types";

export enum InfluencerProfileCategory {
    community = 'community',
    creator = 'creator'
}

export interface SocialAccountForAccountDetails {
    accountId: string;
    username: string;
    agreementStatus: InfluencerConfirmationStatusEnum;
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
    price: number;
    currency: string | null;
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
    denied = 5 // influencer denied this promo request
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
};