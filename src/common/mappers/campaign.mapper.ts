import {DraftCampaign} from "../../database/schemas/campaign/draft-campaign.schema";
import {DetailedDraftCampaignDto} from "../../modules/campaigns/dto/get-campaigns.dto";

export const mapToDetailedDraftCampaignDto = (draft: DraftCampaign): DetailedDraftCampaignDto => {
    return {
        _id: draft._id.toString(),
        campaignName: draft.campaignName,
        socialMedia: draft.socialMedia,
        addedAccounts: draft.addedAccounts.map((acc) => ({
            _id: acc._id.toString(),
            influencerId: acc._id.toString(),
            accountId: acc._id.toString(),
            socialMedia: acc.socialMedia,
            selectedContent: acc.selectedContent
        })),
        campaignContent: draft.campaignContent,
    }
}