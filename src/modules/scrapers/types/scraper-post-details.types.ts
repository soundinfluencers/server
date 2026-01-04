import {Types} from "mongoose";

export type BasePostDetailsItem = {
    url: string;
    likes: number;
    views: number;
    commentsCount: number;
    latestComments?: {
        _id: Types.ObjectId;
        ownerUsername: string;
        text: string;
        ownerLogo?: string;
        creationDate?: string;
    }[];
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
    shares?: number;
    saves?: number;
};

export type TikTokAccountDetailsItem = BaseAccountDetailsItem & {
    engagementRate?: number;
    averageViews?: number;
}

export type FacebookPostDetailsItem = BasePostDetailsItem & {
    shares?: number;
    saves?: number;
};

export type FacebookAccountDetailsItem = BaseAccountDetailsItem & {
    engagementRate?: number;
    averageViews?: number;
}

