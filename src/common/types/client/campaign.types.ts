import {SocialMediaType} from "../social-media.types";

// Campaign status type for development backend
export type CampaignStatusTypeForDevelopment =
    'ongoing' |
    'closed' |
    'proposal'

// Campaign status enum for development backend
export enum CampaignStatusEnumForDevelopment {
    ongoing = 'ongoing',
    closed = 'closed',
    proposal = 'proposal'
}

// Campaign status type for frontend and database
export type CampaignStatusType =
    'Pending' |
    'Distributing' |
    'Completed' ;

// Campaign status enum for frontend and database
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

export interface PublicCampaignForTable {
    campaignId: string;
    clientId: string;
    price: number;
    campaignName: string;
    socialMedia: SocialMediaType | 'multipromo';
    creationDate: string;
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