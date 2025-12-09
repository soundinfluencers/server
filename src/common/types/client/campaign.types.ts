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

export interface ClientGetCampaignForList {
    _id: string;
    campaignName: string;
    socialMedia: SocialMediaType | 'multipromo';
    creationDate: string;
    price: number;
    status: CampaignStatusType;
}