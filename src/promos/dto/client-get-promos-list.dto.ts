import {ClientGetCampaignForList} from "../../types/client/response.types";

export interface ClientGetCampaignsListDto {
    statusCode: number;
    campaigns: ClientGetCampaignForList[];
    message?: string;
}