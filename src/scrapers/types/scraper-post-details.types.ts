export type BasePostDetailsItem = {
    url: string;
    likes: number;
    views: number;
};

export type BaseAccountDetailsItem = {
    accountUrl: string;
    username: string;
    logoUrl: string;
    followers: number;
};

export type InstagramPostDetailsItem = BasePostDetailsItem & {
    creatorLogo?: string;
};

export type InstagramAccountDetailsItem = BaseAccountDetailsItem & {
    engagementRate?: number;
    averageViews?: number;
}

export type TikTokPostDetailsItem = BasePostDetailsItem & {
    shares?: string;
};

export type TikTokAccountDetailsItem = BaseAccountDetailsItem & {
    engagementRate?: number;
    averageViews?: number;
}