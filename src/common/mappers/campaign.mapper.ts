import {DraftCampaign} from "../../database/schemas/campaign/draft-campaign.schema";
import {DetailedDraftCampaignDto} from "../../modules/campaigns/dto/get-campaigns.dto";
import {ClientCampaignForTable, SafeCampaignAccount} from "../types/client/campaign.types";
import {Campaign, CampaignAccount, CampaignContentItem} from "../../database/schemas/campaign/campaign.schema";
import {ProposalCampaignAccount} from "../../database/schemas/campaign/proposal-campaign-option.schema";
import {CampaignContentItemDto} from "../../modules/campaigns/dto/create-campaign.dto";
import {Types} from "mongoose";
import {SocialMediaEnum} from "../types/social-media.types";
import {formatDate} from "../utils/formatters";
import {CompletedCampaign} from "../../database/schemas/campaign/completed-campaign.schema";

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

// map schema Campaign class to ClientCampaignForTable
export const mapToClientCampaignForTable = (campaign: Campaign): ClientCampaignForTable => {
    let cpm: number | null;
    let totalFollowers: number | null;
    let totalImpressions: number | null;
    let totalLikes: number | null;
    let totalSaves: number | null;
    let totalComments: number | null;
    let totalShares: number | null;

    const campaignPrice: number = campaign.campaignPrice ??
        (campaign as any).price ??
        (campaign as any).publicCampaignPrice ??
        (campaign as any).amount ??
        0;

    // build safe campaign account item
    // campaign.addedAccounts = campaign?.addedAccounts?.map(
    //     (account: CampaignAccount):  =>
    // ) ?? [];


    // getting cpm
    try {
        cpm = totalImpressions > 0
                ? Math.round((campaignPrice * 1000 / totalImpressions) * 1000) / 1000
                : null;
    } catch (e) {
        console.warn(`Can't retrieve cpm for campaign ${campaign._id}: ${e}`);
        cpm = null;
    }

    return {
        campaignId: campaign._id.toString(),
        campaignName: campaign.campaignName ?? "OLD CAMPAIGN",
        socialMedia: campaign.socialMedia ?? "instagram",
        creationDate: formatDate(campaign.createdAt),
        price: campaignPrice,
        status: campaign.statusCampaign,
        addedAccounts: campaign.addedAccounts ?? [],
        campaignContent: campaign.campaignContent ?? (campaign as any).videos ?? [],
        shareLink: campaign.shareLink ?? null,

        totalFollowers: totalFollowers ?? 0,
        totalImpressions: totalImpressions ?? 0,
        totalLikes: totalLikes ?? 0,
        totalSaves: totalSaves ?? 0,
        totalComments: totalComments ?? 0,
        totalShares: totalShares ?? 0,

        isCpmAndResultHidden: campaign.isCpmAndResultHidden ?? false,
        isPriceHidden: campaign.isPriceHidden ?? false,
        canEdit: campaign.canEdit ?? false,
        hiddenColumns: campaign.hiddenColumns ?? [],
        cpm: cpm ?? null,
    };
};