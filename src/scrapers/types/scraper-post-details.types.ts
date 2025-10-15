export type BasePostDetailsItem = {
    url: string;
    likes: number;
    views: number;
};

export type InstagramPostDetailsItem = BasePostDetailsItem & {
    creatorLogo?: string;
};

export type TikTokPostDetailsItem = BasePostDetailsItem & {
    shares?: string;
};
