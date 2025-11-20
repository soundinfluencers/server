import {ClientGetCampaignForList} from "../../types/client/campaign.types";

export interface ClientGetCampaignsListDto {
    statusCode: number;
    campaigns?: ClientGetCampaignForList[];
    message?: string;
}