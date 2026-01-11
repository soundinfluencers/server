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

    instagramAccounts: SocialAccountForAccountDetails[];
    tiktokAccounts: SocialAccountForAccountDetails[];
    spotifyAccounts: SocialAccountForAccountDetails[];
    youtubeAccounts: SocialAccountForAccountDetails[];
    facebookAccounts: SocialAccountForAccountDetails[];
    soundcloudAccounts: SocialAccountForAccountDetails[];
    pressAccounts: SocialAccountForAccountDetails[];

    lastName?: string;
    telegramUsername?: string;
    profilePhotoUrl?: string;
}