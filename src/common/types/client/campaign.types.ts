import {SocialMediaType} from "../social-media.types";

export type CampaignStatusType =
    'Pending' |
    'Distributing' |
    'Completed' ;

export enum CampaignStatusEnum {
    Pending = 'Pending',
    Distributing = 'Distributing',
    Completed = 'Completed',
}

// Using at home page
export interface ClientGetCampaignForList {
    _id: string;
    campaignName: string;
    socialMedia: SocialMediaType | 'multipromo';
    creationDate: string;
    price: number;
    status: CampaignStatusType;
}

// Used by campaign report page
export interface ClientCampaignForTable {
    campaignId: string;
    campaignName: string;
    socialMedia: SocialMediaType | 'multipromo';
    creationDate: string;
    price: number;
    status: CampaignStatusType;

    // TODO: interface for campaign's added accounts
    addedAccounts: any[];

    // TODO: interface for campaign content
    campaignContent: any[];

    shareLink: string;
    totalFollowers: number;
    totalLikes: number;
    totalImpressions: number;
    isClosed: boolean;
    isCpmAndResultHidden: boolean;
    isPriceHidden: boolean;
    hiddenColumns: string[];
}