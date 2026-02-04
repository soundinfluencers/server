import {DraftCampaign} from "../../database/schemas/campaign/draft-campaign.schema";
import {DetailedDraftCampaignDto} from "../../modules/campaigns/dto/get-campaigns.dto";
import {SafeCampaignAccount} from "../types/client/campaign.types";
import {CampaignAccount} from "../../database/schemas/campaign/campaign.schema";
import {ProposalCampaignAccount} from "../../database/schemas/campaign/proposal-campaign-option.schema";

// export const mapToDetailedDraftCampaignDto = (draft: DraftCampaign): DetailedDraftCampaignDto => {
//     return {
//         _id: draft._id.toString(),
//         campaignName: draft.campaignName,
//         socialMedia: draft.socialMedia,
//         addedAccounts: draft.addedAccounts.map((acc) => ({
//             _id: acc._id.toString(),
//             influencerId: acc._id.toString(),
//             accountId: acc._id.toString(),
//             socialMedia: acc.socialMedia,
//             selectedContent: acc.selectedContent
//         })),
//         campaignContent: draft.campaignContent,
//     }
// }

export const mapToSafeCampaignAccount = (
    account: CampaignAccount | ProposalCampaignAccount
): SafeCampaignAccount => {
    return {
        addedAccountsId: account._id.toString(),
        socialAccountId: account.accountId.toString(),
        influencerId: account.influencerId.toString(),
        socialMedia: account.socialMedia,
        username: account.username,
        publicPrice: account.publicPrice,
        followers: account.followers,
        selectedContent: account.selectedContent,
        confirmation: account.confirmation,
        closePromo: account.closePromo,
        dateRequest: account.dateRequest ?? null,
        datePost: account.datePost ?? null,
        postLink: account.postLink ?? null,
        screenshot: account.screenshot ?? null,
        impressions: account.impressions ?? null,
        like: account.like ?? null,
        comments: account.comments ?? null,
        shares: account.shares ?? null,
        saves: account.saves ?? null,
        rating: account.rating ?? null,
        genres: (account as ProposalCampaignAccount).genres ?? null,
        countries: (account as ProposalCampaignAccount).countries ?? null,
    }
}