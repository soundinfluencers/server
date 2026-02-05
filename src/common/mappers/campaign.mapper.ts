import {DraftCampaign} from "../../database/schemas/campaign/draft-campaign.schema";
import {DetailedDraftCampaignDto} from "../../modules/campaigns/dto/get-campaigns.dto";
import {SafeCampaignAccount} from "../types/client/campaign.types";
import {CampaignAccount, CampaignContentItem} from "../../database/schemas/campaign/campaign.schema";
import {ProposalCampaignAccount} from "../../database/schemas/campaign/proposal-campaign-option.schema";
import {CampaignContentItemDto} from "../../modules/campaigns/dto/create-campaign.dto";
import {Types} from "mongoose";
import {SocialMediaEnum} from "../types/social-media.types";

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

// builds object with CampaignContentItemDto type from CampaignContentItem (dto which using for creating and updating campaigns)
export const mapContentItemDtoToModel = (campaignContentItem: CampaignContentItemDto): CampaignContentItem => {
    return {
        _id: new Types.ObjectId(campaignContentItem._id),
        mainLink: campaignContentItem.mainLink.trim(),
        socialMedia: campaignContentItem.socialMedia as SocialMediaEnum,
        socialMediaGroup: campaignContentItem.socialMediaGroup,
        descriptions: campaignContentItem?.descriptions.map((pd) => ({
            _id: new Types.ObjectId(pd._id),
            description: pd.description.trim(),
        })) ?? undefined,
        taggedUser: campaignContentItem.taggedUser?.trim() ?? undefined,
        taggedLink: campaignContentItem.taggedLink?.trim() ?? undefined,
        additionalBrief: campaignContentItem.additionalBrief?.trim() ?? undefined,
    } satisfies CampaignContentItem;
};

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