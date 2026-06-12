import {
    CampaignStatusEnum,
    IAdminCampaignAccount,
    IAdminCampaignDetails,
    IAdminCampaignForList,
    ICampaignAccount,
    ICampaignDetails,
    IDetailedSelectedContent,
    IProposalCampaign,
    IProposalOption
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
import {
    AdminPromoStatusLabelEnum,
    InfluencerConfirmationStatusEnum,
    InfluencerPromoClosedStatusEnum
} from "../types/influencer/promo.types";
import {safeParseToNumber} from "../utils/base.util";
import {CompletedCampaign} from "../../database/schemas/campaign/completed-campaign.schema";
import {CampaignAccountDto, CampaignDetailsDto} from "../../modules/campaigns/dto/get-campaigns.dto";
import {ProposalCampaign} from "../../database/schemas/campaign/proposal-campaign.schema";
import {
    AdminCampaignAccountDto,
    AdminCampaignDetailsDto,
    AdminCampaignForListDto,
    AdminCampaignsListStatusEnum
} from "../../modules/admin/dto/campaigns/admin-campaigns.dto";
import {CurrencyCode} from "../types/finance.types";
import {InternalServerErrorException} from "@nestjs/common";

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
        profileType: campaignContentItem.profileType ?? undefined,
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
        price: account.price,
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

// Map campaign account mongoose model to IAdminCampaignAccount
export const mapToIAdminCampaignAccount = (
    account: CampaignAccount | ProposalCampaignAccount,
    selectedContentItem: IDetailedSelectedContent | null = null,
    cpm: number | null,
    firstName: string | null,
): IAdminCampaignAccount => {
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
        profileType: (account as any)?.profileType ?? (account as any)?.profileCategory ?? null,
        price: account.price,
        currency: (account as any)?.currency,
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
        cpm: cpm ?? undefined,
        genres: "genres" in account ? account.genres : undefined,
        countries: "countries" in account ? account.countries : undefined,
        firstName: firstName !== null ? firstName : null,
    };
}

// map Campaign mongoose model to ICampaignDetails
export const mapSchemaToICampaignDetails = (campaign: Campaign | CompletedCampaign): ICampaignDetails => {
    let cpm: number | null;
    let totalFollowers: number = 0;
    let totalImpressions: number = 0;
    let totalLikes: number = 0;
    let totalSaves: number = 0;
    let totalComments: number = 0;
    let totalShares: number = 0;
    let totalFavorites: number = 0;

    // getting campaign price
    const campaignPrice: number = campaign?.campaignPrice ?? (campaign as any)?.price ?? (campaign as any)?.amount ?? 0;

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
                totalComments += safeParseToNumber(account.comments);
                totalShares += safeParseToNumber(account.shares);
                totalFavorites += safeParseToNumber(account.favorites);
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
        displayCurrency: campaign.displayCurrency ?? CurrencyCode.EUR,
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
        totalFavorites: totalFavorites ?? 0,

        isCpmAndResultHidden: campaign.isCpmAndResultHidden ?? false,
        isPriceHidden: campaign.isPriceHidden ?? false,
        canEdit: [CampaignStatusEnum.underReview, CampaignStatusEnum.pending].includes(campaign.statusCampaign) && campaign.canEdit,
        hiddenColumns: campaign.hiddenColumns ?? [],
        cpm: cpm ?? null,
    };
};

// map Campaign mongoose model to IAdminCampaignDetails
export const mapSchemaToIAdminCampaignDetails = (campaign: Campaign | CompletedCampaign): IAdminCampaignDetails => {
    let cpm: number | null;
    let totalFollowers: number = 0;
    let totalImpressions: number = 0;
    let totalLikes: number = 0;
    let totalSaves: number = 0;
    let totalComments: number = 0;
    let totalShares: number = 0;
    let totalFavorites: number = 0;

    // getting campaign price
    const campaignPrice: number = campaign.campaignPrice ?? (campaign as any).price ?? (campaign as any).amount ?? 0;

    // build safe campaign account item
    let proceedAccounts: IAdminCampaignAccount[] = campaign?.addedAccounts?.map(
        (account: CampaignAccount): IAdminCampaignAccount => {
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

            const accountCpm = account.impressions > 0
                ? Math.round((account.publicPrice * 1000 / account.impressions) * 1000) / 1000
                : null;

            // counting meta
            totalFollowers += safeParseToNumber(account.followers);

            if (isPromoConfirmed) {
                totalLikes += safeParseToNumber(account.like);
                totalImpressions += safeParseToNumber(account.impressions);
                totalSaves += safeParseToNumber(account.saves);
                totalComments += safeParseToNumber(account.comments);
                totalShares += safeParseToNumber(account.shares);
                totalFavorites += safeParseToNumber(account.favorites);
            }

            const firstName = (account as any)?.firstName ?? null;

            return mapToIAdminCampaignAccount(account, selectedCampaignContentItem, accountCpm, firstName);
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
        displayCurrency: campaign.displayCurrency ?? CurrencyCode.EUR,
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
        totalFavorites: totalFavorites ?? 0,

        isCpmAndResultHidden: campaign.isCpmAndResultHidden ?? false,
        isPriceHidden: campaign.isPriceHidden ?? false,
        canEdit: [CampaignStatusEnum.underReview, CampaignStatusEnum.pending].includes(campaign.statusCampaign) && campaign.canEdit,
        hiddenColumns: campaign.hiddenColumns ?? [],
        cpm: cpm ?? null,
    };
};

// Map ICampaignDetails read model to CampaignDetailsDto
export const mapToCampaignDetailsDto = (campaign: ICampaignDetails): CampaignDetailsDto => {
    if (!campaign.addedAccounts.length) throw new InternalServerErrorException("Can't get promos list for this campaign");

    return {
        campaignId: campaign._id.toString(),
        campaignName: campaign.campaignName,
        socialMedia: campaign.socialMedia,
        creationDate: formatDate(campaign.createdAt),
        price: campaign.price,
        displayCurrency: campaign.displayCurrency ?? CurrencyCode.EUR,
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

// Map IAdminCampaignDetails read model to AdminCampaignDetailsDto
export const mapToAdminCampaignDetailsDto = (campaign: IAdminCampaignDetails): AdminCampaignDetailsDto => {
    if (!campaign.addedAccounts.length) throw new InternalServerErrorException("Can't get promos list for this campaign");

    let internalCost: number = 0;

    if (campaign.socialMedia !== SocialMediaEnum.press) {
        internalCost = campaign.addedAccounts.reduce(
            (sum, acc) => sum + (acc.price ?? 0),
            0
        );
    }

    return {
        campaignId: campaign._id.toString(),
        campaignName: campaign.campaignName,
        socialMedia: campaign.socialMedia,
        creationDate: formatDate(campaign.createdAt),
        price: campaign.price,
        displayCurrency: campaign.displayCurrency ?? CurrencyCode.EUR,
        status: campaign.status,
        addedAccounts: campaign.addedAccounts.map((i: IAdminCampaignAccount): AdminCampaignAccountDto => ({
            ...i,
            addedAccountsId: i.addedAccountsId.toString(),
            socialAccountId: i.socialAccountId.toString(),
            influencerId: i.influencerId.toString(),
            selectedContent: {
                campaignContentItemId: i.selectedContent?.campaignContentItemId?.toString(),
                descriptionId: i.selectedContent?.descriptionId?.toString()
            },
            selectedContentItem: {
                ...i.selectedContentItem,
                _id: i.selectedContentItem?._id?.toString(),
            },
            ...i.firstName ? {firstName: i.firstName} : {},
            ...campaign.status as any !== 'proposal' ? {statusLabel: getAdminPromoStatusLabel(i)} : {},
            ...(i.cpm !== undefined ? {cpm: i.cpm} : {})
        } satisfies AdminCampaignAccountDto)),
        campaignContent: campaign.campaignContent ?? (campaign as any).videos ?? [],
        shareLink: campaign.shareLink,
        totalFollowers: campaign.totalFollowers,
        totalImpressions: campaign.totalImpressions,
        totalLikes: campaign.totalLikes,
        totalSaves: campaign.totalSaves,
        totalComments: campaign.totalComments,
        totalShares: campaign.totalShares,
        internalCost: internalCost,
        isCpmAndResultHidden: campaign.isCpmAndResultHidden,
        isPriceHidden: campaign.isPriceHidden,
        canEdit: campaign.canEdit,
        hiddenColumns: campaign.hiddenColumns ?? [],
        cpm: campaign.cpm,
        ...campaign.existingOptions && campaign.existingOptions.length > 0 ? {existingOptions: campaign.existingOptions} : {},
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

// Map ProposalCampaign + ProposalCampaignOption to IAdminCampaignDetails
export const mapProposalToIAdminCampaignDetails = (
    campaign: ProposalCampaign,
    option: ProposalCampaignOption,
): IAdminCampaignDetails => {
    let totalFollowers = 0;
    let totalImpressions = 0;
    let totalLikes = 0;
    let totalSaves = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalFavorites = 0;

    const proceedAccounts: IAdminCampaignAccount[] = (option.addedAccounts ?? []).map(
        (account: ProposalCampaignAccount): IAdminCampaignAccount => {
            const selectedCampaignContentItemId =
                account.selectedContent?.campaignContentItemId?.toString() ?? null;

            let selectedCampaignContentItem = null;
            if (selectedCampaignContentItemId && Array.isArray(option.campaignContent)) {
                const contentItem = option.campaignContent.find(
                    item => item?._id?.toString() === selectedCampaignContentItemId,
                );
                if (contentItem) {
                    let description = '';
                    try {
                        description =
                            contentItem.descriptions?.find(
                                pd =>
                                    pd._id?.toString() ===
                                    account.selectedContent?.descriptionId?.toString(),
                            )?.description ?? '';
                    } catch {
                    }

                    selectedCampaignContentItem = {
                        _id: contentItem._id,
                        mainLink: contentItem.mainLink ?? null,
                        description,
                        taggedUser: contentItem.taggedUser ?? null,
                        taggedLink: contentItem.taggedLink ?? null,
                        additionalBrief: contentItem.additionalBrief ?? null,
                    };
                }
            }

            const accountCpm =
                account.impressions > 0
                    ? Math.round(((account.publicPrice * 1000) / account.impressions) * 1000) / 1000
                    : null;

            totalFollowers += safeParseToNumber(account.followers);
            totalImpressions += safeParseToNumber(account.impressions);
            totalLikes += safeParseToNumber(account.like);
            totalSaves += safeParseToNumber(account.saves);
            totalComments += safeParseToNumber(account.comments);
            totalShares += safeParseToNumber(account.shares);
            totalFavorites += safeParseToNumber(account.favorites);

            return mapToIAdminCampaignAccount(account, selectedCampaignContentItem, accountCpm, null);
        },
    );

    const campaignPrice = option.publicCampaignPrice ?? 0;
    const cpm =
        totalImpressions > 0
            ? Math.round(((campaignPrice * 1000) / totalImpressions) * 1000) / 1000
            : null;

    return {
        _id: campaign._id,
        campaignName: campaign.campaignName ?? 'OLD CAMPAIGN',
        socialMedia: campaign.socialMedia ?? 'instagram',
        createdAt: campaign.createdAt,
        price: campaignPrice,
        displayCurrency: option.displayCurrency ?? CurrencyCode.EUR,
        status: 'proposal' as CampaignStatusEnum,
        addedAccounts: proceedAccounts,
        campaignContent: option.campaignContent ?? [],
        shareLink: null,
        totalFollowers,
        totalImpressions,
        totalLikes,
        totalSaves,
        totalComments,
        totalShares,
        totalFavorites,
        isCpmAndResultHidden: false,
        isPriceHidden: false,
        canEdit: true,
        hiddenColumns: campaign.hiddenColumns ?? [],
        cpm,
        existingOptions: campaign.optionsIds.map((_, i) => i),
    };
};

// Map IAdminCampaignForList read model to AdminCampaignForListDto
export const mapToAdminCampaignForListDto = (
    campaign: IAdminCampaignForList,
): AdminCampaignForListDto => {
    return {
        campaignId: campaign._id.toString(),
        socialMedia: campaign.socialMedia,
        campaignName: campaign.campaignName,
        creatorRole: campaign.creatorRole,
        creatorName: campaign.creatorName,
        creatorCompanyName: campaign.creatorCompanyName,
        ...campaign.status !== AdminCampaignsListStatusEnum.proposal ? {followers: campaign.totalFollowers} : null,
        ...campaign.status !== AdminCampaignsListStatusEnum.proposal ? {cost: campaign.price} : null,
        ...campaign.status !== AdminCampaignsListStatusEnum.proposal ? {salePrice: campaign.publicPrice} : null,
        date: formatDate(campaign.createdAt),
        status: campaign.status,
        statusLabel: campaign.statusLabel,
        reportSent: campaign.reportSent,
        ...campaign.status !== AdminCampaignsListStatusEnum.proposal ? {paymentStatus: campaign.paymentStatus} : null,
        ...campaign.invoiceId ? {invoiceId: campaign.invoiceId.toString()} : null,
        ...campaign.invoiceId ? {shortInvoiceNumber: campaign.shortInvoiceNumber} : null,
        notes: campaign.notes,
        affiliatePartner: campaign.affiliatePartner,
        affiliateCommission: campaign.affiliateCommission,
        affiliatePaid: campaign.affiliatePaid,
    };
};

// Get AdminPromoStatusLabelEnum from promo info
const getAdminPromoStatusLabel = (promo: IAdminCampaignAccount): AdminPromoStatusLabelEnum => {
    if (promo.confirmation === InfluencerConfirmationStatusEnum.wait) return AdminPromoStatusLabelEnum.requested;
    if (promo.confirmation === InfluencerConfirmationStatusEnum.decline) return AdminPromoStatusLabelEnum.declined;
    if (promo.confirmation === InfluencerConfirmationStatusEnum.accept && promo.closePromo === InfluencerPromoClosedStatusEnum.wait)
        return AdminPromoStatusLabelEnum.accepted;
    if (promo.confirmation === InfluencerConfirmationStatusEnum.accept && promo.closePromo === InfluencerPromoClosedStatusEnum.close)
        return AdminPromoStatusLabelEnum.insightsSubmitted;

    return AdminPromoStatusLabelEnum.na;
}