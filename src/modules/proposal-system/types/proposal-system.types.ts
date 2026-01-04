import {SocialMediaEnum} from "../../../common/types/social-media.types";

export interface ProposalCampaignsListItem {
    // id of creator
    clientId: string;
    // creator's first name
    clientName: string;

    campaignId: string;
    campaignName: string;
    socialMedia: SocialMediaEnum | 'multipromo';
    totalFollowers: number;
    price: number;
    publicPrice: number;
    creationDate: string;

    // TODO: ask about proposal campaigns statuses
    campaignStatus: string;
}