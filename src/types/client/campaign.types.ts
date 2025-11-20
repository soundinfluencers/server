import {SocialMediaType} from "../social-media.types";

export type CampaignStatusType =
    'Pending' |
    'Distributing' |
    'Completed' ;

export interface ClientGetCampaignForList {
    _id: string;
    campaignName: string;
    socialMedia: SocialMediaType | 'multipromo';
    creationDate: string;
    price: number;
    status: CampaignStatusType;
}