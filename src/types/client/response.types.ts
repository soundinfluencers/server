import {SocialMediaType} from "../social-media.types";

export interface ClientGetCampaignForList {
    _id: string;
    campaignName: string;
    socialMedia: SocialMediaType | 'multipromo';
    creationDate: string;
    price: string;
    status: string;
}