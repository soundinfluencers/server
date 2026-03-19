import {
    CampaignStatusEnum, ICampaignAccount,
    ICampaignDetails,
    IDetailedSelectedContent, IProposalCampaign, IProposalOption
} from "../types/client/campaign.types";
import {Campaign, CampaignAccount, CampaignContentItem} from "../../database/schemas/campaign/campaign.schema";
import {
    ProposalCampaignAccount,
    ProposalCampaignOption
} from "../../database/schemas/campaign/proposal-campaign-option.schema";
import {CampaignContentItemDto} from "../../modules/campaigns/dto/create-campaign.dto";
import {Types} from "mongoose";
import {SocialMediaEnum} from "../types/social-media.types";
import {formatDate} from "../utils/formatters";
import {InfluencerConfirmationStatusEnum, InfluencerPromoClosedStatusEnum} from "../types/influencer/promo.types";
import {safeParseToNumber} from "../utils/base.util";
import {CompletedCampaign} from "../../database/schemas/campaign/completed-campaign.schema";
import {CampaignAccountDto, CampaignDetailsDto} from "../../modules/campaigns/dto/get-campaigns.dto";
import {ProposalCampaign} from "../../database/schemas/campaign/proposal-campaign.schema";

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

// Map campaign account mongoose model to ICampaignAccount
export const mapToICampaignAccount = (
    account: CampaignAccount | ProposalCampaignAccount,
    selectedContentItem: IDetailedSelectedContent | null = null
): ICampaignAccount => {
    // NOTE: commented because sometimes users don't use website and admin close promos by them (so confirmation still wait)
    // const isPromoConfirmed = account.confirmation === InfluencerConfirmationStatusEnum.accept;
    const isPromoConfirmed = true;

    return {
        addedAccountsId: account._id,
        socialAccountId: account.accountId,
        influencerId: account.influencerId,
        socialMedia: account.socialMedia,
        username: account.username,
        logoUrl: (account as any)?.logoUrl ?? null,
        publicPrice: account.publicPrice,
        followers: safeParseToNumber(account.followers),
        selectedContent: account.selectedContent,
        selectedContentItem: selectedContentItem,
        confirmation: account.confirmation ?? InfluencerConfirmationStatusEnum.wait,
        closePromo: account.closePromo ?? InfluencerPromoClosedStatusEnum.wait,
        dateRequest: account.dateRequest ?? null,
        datePost: account.datePost ?? null,
        postLink: account.postLink ?? null,
        screenshot: account.screenshot ?? null,
        impressions: isPromoConfirmed ? safeParseToNumber(account.impressions) : null,
        like: isPromoConfirmed ? safeParseToNumber(account.like) : null,
        comments: isPromoConfirmed ? safeParseToNumber(account.comments) : null,
        shares: isPromoConfirmed ? safeParseToNumber(account.shares) : null,
        saves: isPromoConfirmed ? safeParseToNumber(account.saves) : null,
        rating: isPromoConfirmed ? safeParseToNumber(account.rating) : null,
        genres: "genres" in account ? account.genres : undefined,
        countries: "countries" in account ? account.countries : undefined,
    };
}

// map Campaign mongoose model to ICampaignDetails
export const mapSchemaToICampaignDetails = (campaign: Campaign | CompletedCampaign): ICampaignDetails => {
    let cpm: number | null;
    let totalFollowers: number | null;
    let totalImpressions: number | null;
    let totalLikes: number | null;
    let totalSaves: number | null;
    let totalComments: number | null;
    let totalShares: number | null;

    // getting campaign price
    const campaignPrice: number = campaign.campaignPrice ?? (campaign as any).price ?? (campaign as any).amount ?? 0;

    // build safe campaign account item
    let proceedAccounts: ICampaignAccount[] = campaign?.addedAccounts?.map(
        (account: CampaignAccount): ICampaignAccount => {
            // NOTE: commented because sometimes users don't use website and admin close promos by them (so confirmation still wait)
            // const isPromoConfirmed = account.confirmation === InfluencerConfirmationStatusEnum.accept;
            const isPromoConfirmed = true;

            const selectedCampaignContentItemId: string | Types.ObjectId =
                account?.selectedContent?.campaignContentItemId?.toString() ??
                (account as any)?.selectedCampaignContentItem?.toString() ??
                (Array.isArray((campaign as any)?.videos)
                    ? (campaign as any).videos?.find((v) => v.videoLink === (account as any)?.selectedVideo)?._id?.toString()
                    : null) ??
                null;

            let selectedCampaignContentItem = null;
            if (selectedCampaignContentItemId) {
                selectedCampaignContentItem =
                    (Array.isArray(campaign.campaignContent)
                        ? (() => {
                            const contentItem = campaign.campaignContent.find(
                                (item) => item?._id.toString() === selectedCampaignContentItemId,
                            );
                            if (!contentItem) return null;

                            let description: string;
                            try {
                                description = contentItem.descriptions?.find(
                                    (pd) => pd._id.toString() === account.selectedContent?.descriptionId.toString(),
                                )?.description ?? (contentItem as any)?.postDescription ?? '';
                            } catch (err) {
                                console.warn(`Can't get description for addedAccounts ${account._id} in campaign ${campaign._id}`);
                            }

                            return {
                                _id: contentItem._id,
                                mainLink: contentItem.mainLink ?? (contentItem as any).videoLink ?? null,
                                description: description ?? null,
                                taggedUser: contentItem.taggedUser ?? (contentItem as any).storyTag ?? null,
                                taggedLink: contentItem.taggedLink ?? (contentItem as any).swipeUpLink ?? null,
                                additionalBrief: contentItem.additionalBrief ?? (contentItem as any).specialWishes ?? null,
                            };
                        })()
                        : null) ??
                    (Array.isArray((campaign as any).videos)
                        ? (campaign as any).videos.find(
                            (item) => item?._id?.toString() === selectedCampaignContentItemId?.toString(),
                        )
                        : null) ??
                    null;
            }

            account.selectedContent = {
                campaignContentItemId: new Types.ObjectId(selectedCampaignContentItemId),
                descriptionId: account.selectedContent.descriptionId ?? undefined
            };

            // counting meta
            totalFollowers += safeParseToNumber(account.followers);

            if (isPromoConfirmed) {
                totalLikes += safeParseToNumber(account.like);
                totalImpressions += safeParseToNumber(account.impressions);
                totalSaves += safeParseToNumber(account.saves);
                totalComments = safeParseToNumber(account.comments);
                totalShares = safeParseToNumber(account.shares);
            }

            return mapToICampaignAccount(account, selectedCampaignContentItem);
        }
    ) ?? [];

    try {
        proceedAccounts.sort((a, b) => {
            const aIndex = Array.isArray(campaign.campaignContent)
                ? campaign.campaignContent.findIndex(
                    (c) => c?._id?.toString() === a.selectedContent.campaignContentItemId?.toString(),
                )
                : Array.isArray((campaign as any).videos)
                    ? (campaign as any).videos.findIndex(
                        (v) => v?._id?.toString() === (a as any)?.selectedCampaignContentItemId?.toString(),
                    )
                    : -1;

            const bIndex = Array.isArray(campaign.campaignContent)
                ? campaign.campaignContent.findIndex(
                    (c) => c?._id?.toString() === b.selectedContent.campaignContentItemId?.toString(),
                )
                : Array.isArray((campaign as any).videos)
                    ? (campaign as any).videos.findIndex(
                        (v) => v?._id?.toString() === (b as any)?.selectedCampaignContentItemId?.toString(),
                    )
                    : -1;

            return aIndex - bIndex;
        });
    } catch (e) {
        console.warn(`Error sorting accounts in ${campaign._id}`, e)
    }

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
        _id: campaign._id,
        campaignName: campaign.campaignName ?? "OLD CAMPAIGN",
        socialMedia: campaign.socialMedia ?? "instagram",
        createdAt: campaign.createdAt,
        price: campaignPrice,
        status: campaign.statusCampaign,
        addedAccounts: proceedAccounts,
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
        canEdit: [CampaignStatusEnum.underReview, CampaignStatusEnum.pending].includes(campaign.statusCampaign) && campaign.canEdit,
        hiddenColumns: campaign.hiddenColumns ?? [],
        cpm: cpm ?? null,
    };
};

// Map ICampaignDetails read model to CampaignDetailsDto
export const mapToCampaignDetailsDto = (campaign: ICampaignDetails): CampaignDetailsDto => {
    return {
        campaignId: campaign._id.toString(),
        campaignName: campaign.campaignName,
        socialMedia: campaign.socialMedia,
        creationDate: formatDate(campaign.createdAt),
        price: campaign.price,
        status: campaign.status,
        addedAccounts: campaign.addedAccounts.map((i: ICampaignAccount): CampaignAccountDto => ({
            ...i,
            addedAccountsId: i.addedAccountsId.toString(),
            socialAccountId: i.socialAccountId.toString(),
            influencerId: i.influencerId.toString(),
            selectedContent: {
                campaignContentItemId: i.selectedContent.campaignContentItemId.toString(),
                descriptionId: i.selectedContent.descriptionId.toString()
            },
            selectedContentItem: {
                ...i.selectedContentItem,
                _id: i.selectedContentItem._id.toString(),
            },
        })),
        campaignContent: campaign.campaignContent ?? (campaign as any).videos ?? [],
        shareLink: campaign.shareLink,
        totalFollowers: campaign.totalFollowers,
        totalImpressions: campaign.totalImpressions,
        totalLikes: campaign.totalLikes,
        totalSaves: campaign.totalSaves,
        totalComments: campaign.totalComments,
        totalShares: campaign.totalShares,
        isCpmAndResultHidden: campaign.isCpmAndResultHidden,
        isPriceHidden: campaign.isPriceHidden,
        canEdit: campaign.canEdit,
        hiddenColumns: campaign.hiddenColumns ?? [],
        cpm: campaign.cpm,
    }
};

// Map ProposalCampaign mongoose model to IProposalCampaign
export const mapToIProposalCampaign = (campaign: ProposalCampaign): IProposalCampaign => {
    return {
        _id: campaign._id,
        campaignName: campaign.campaignName ?? "OLD CAMPAIGN",
        socialMedia: campaign.socialMedia as SocialMediaEnum ?? "instagram" as SocialMediaEnum,
        optionIds: campaign.optionsIds
    };
};

// Map ProposalCampaignOption mongoose model to IProposalOption
export const mapToIProposalOption = (campaignOption: ProposalCampaignOption): IProposalOption => {
  return {
      _id: campaignOption._id,
      proposalCampaignId: campaignOption.proposalCampaignId,
      publicCampaignPrice: campaignOption.publicCampaignPrice,
      privateCampaignPrice: campaignOption.privateCampaignPrice,
      addedAccounts: campaignOption.addedAccounts.map((acc: ProposalCampaignAccount): ICampaignAccount => mapToICampaignAccount(acc)),
      campaignContent: campaignOption.campaignContent ?? [],
  }
};