import {CampaignAction} from "../../schemas/histories/influencer-actions-history.schema";

export class CampaignActionWithCampaignMeta extends CampaignAction {
    campaignId: string;
    campaignName: string;
}