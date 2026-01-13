import {InfluencerCountryStats, InfluencerMusicGenre} from "../../../database/schemas/users/influencer.schema";

export enum InfluencerProfileCategory {
    community = 'community',
    creator = 'creator'
}

export interface SocialAccountForAccountDetails {
    accountId: string;
    username: string;
}

// interface for account settings page
export interface InfluencerAccountDetails {
    firstName: string;
    email: string;
    phone: string;

    instagram: SocialAccountForAccountDetails[];
    tiktok: SocialAccountForAccountDetails[];
    spotify: SocialAccountForAccountDetails[];
    youtube: SocialAccountForAccountDetails[];
    facebook: SocialAccountForAccountDetails[];
    soundcloud: SocialAccountForAccountDetails[];
    press: SocialAccountForAccountDetails[];

    lastName?: string;
    telegramUsername?: string;
    profilePhotoUrl?: string;
}

export interface SocialAccountDetails {
    _id: string;
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