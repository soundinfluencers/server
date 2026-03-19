import {BaseRepository} from "../base.repository";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, PipelineStage, Types} from "mongoose";
import {DraftCampaign, DraftCampaignDocument} from "../../schemas/campaign/draft-campaign.schema";
import {Influencer} from "../../schemas/users/influencer.schema";
import {CampaignContentItemDto, SaveDraftCampaignDto} from "../../../modules/campaigns/dto/create-campaign.dto";
import {ObjId} from "../../../common/types/base.types";
import {Campaign, CampaignContentItem} from "../../schemas/campaign/campaign.schema";
import {
    CampaignConfirmationEnum,
    CampaignDraftLatestStep,
    CampaignStatusEnum, IDashboardCampaign
} from "../../../common/types/client/campaign.types";
import {mapContentItemDtoToModel} from "../../../common/mappers/campaign.mapper";
import {DetailedDraftCampaignDto} from "../../../modules/campaigns/dto/get-campaigns.dto";

// Interface for DraftCampaignRepository
export interface IDraftCampaignRepository {
    getDashboardCampaigns(
        clientId: string,
        limit: number,
        skip: number,
    ): Promise<IDashboardCampaign[]>;
    saveDraftCampaign(payload: SaveDraftCampaignDto): Promise<void>;
    getDetailedDraftCampaign(draftId: string, clientId: string): Promise<DetailedDraftCampaignDto>;
}

@Injectable()
export class DraftCampaignRepository extends BaseRepository<DraftCampaignDocument> implements IDraftCampaignRepository {
    constructor(
        @InjectModel(DraftCampaign.name)
        private readonly draftCampaign: Model<DraftCampaignDocument>,
        @InjectModel(Influencer.name)
        private readonly influencer: Model<Influencer>
    ) {
        super(draftCampaign);
    }

    async getDashboardCampaigns(
        clientId: string,
        limit: number = 10,
        skip: number = 0,
    ): Promise<IDashboardCampaign[]> {
        const drafts: DraftCampaign[] = await this.draftCampaign
            .find({
                clientId: new Types.ObjectId(clientId),
            })
            .lean()
            .limit(limit)
            .skip(skip)
            .exec();

        return drafts.map((campaign: DraftCampaign): IDashboardCampaign => ({
            _id: campaign._id,
            campaignName: campaign.campaignName,
            socialMedia: campaign.socialMedia,
            createdAt: campaign.createdAt,
            clientStatus: "draft"
        }));
    }

    async saveDraftCampaign(payload: SaveDraftCampaignDto): Promise<void> {
        if (!payload.clientId) {
            throw new Error("clientId is required");
        }

        const clientObjectId = new ObjId(payload.clientId);

        // mapping accounts from dto type to model type
        const mappedAddedAccounts = (payload.addedAccounts ?? []).map((item) => ({
            _id: new ObjId(),
            influencerId: new ObjId(item.influencerId),
            accountId: new ObjId(item.socialAccountId),
            socialMedia: item.socialMedia,
            selectedContent: item.selectedContent
                ? {
                    campaignContentItemId: new ObjId(item.selectedContent.campaignContentItemId),
                    descriptionId: new ObjId(item.selectedContent.descriptionId),
                }
                : undefined,
        }));

        let mappedCampaignContent: CampaignContentItem[] | undefined = undefined;

        // mapping campaignContent from dto type to model type if it's not first step
        if (payload.step !== CampaignDraftLatestStep.addAccounts) {
            mappedCampaignContent = (payload.campaignContent ?? []).map(
                (campaignContentItem: CampaignContentItemDto): CampaignContentItem => mapContentItemDtoToModel(campaignContentItem)
            );
        }

        const draftId = payload.draftId
            ? new ObjId(payload.draftId)
            : new ObjId();

        // create object with finalized payload
        const updateData = {
            _id: draftId,
            clientId: clientObjectId,
            latestStep: payload.step,
            socialMedia: payload.socialMedia,
            addedAccounts: mappedAddedAccounts,
            campaignName: payload.campaignName,
            campaignContent: mappedCampaignContent ? mappedCampaignContent : undefined,
        };

        // saving draft
        const draft = await this.draftCampaign.findOneAndUpdate(
            {
                _id: draftId,
                clientId: clientObjectId,
            },
            {
                $set: updateData,
            },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
            },
        );

        if (!draft) {
            throw new Error("Something went wrong while saving this draft");
        }
    }

    async getDetailedDraftCampaign(
        draftId: string,
        clientId: string,
    ): Promise<DetailedDraftCampaignDto | null> {
        const pipeline: PipelineStage[] = [
            {
                $match: {
                    _id: new ObjId(draftId),
                    clientId: new ObjId(clientId),
                },
            },

            {
                $addFields: {
                    addedAccounts: { $ifNull: ["$addedAccounts", []] },
                    campaignContent: { $ifNull: ["$campaignContent", []] },
                },
            },

            {
                $unwind: {
                    path: "$addedAccounts",
                    preserveNullAndEmptyArrays: true,
                },
            },

            {
                $lookup: {
                    from: this.influencer.collection.name,
                    let: {
                        influencerId: "$addedAccounts.influencerId",
                        accountId: "$addedAccounts.accountId",
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$_id", "$$influencerId"],
                                },
                            },
                        },
                        {
                            $project: {
                                allAccounts: {
                                    $concatArrays: [
                                        {
                                            $map: {
                                                input: { $ifNull: ["$instagram", []] },
                                                as: "a",
                                                in: {
                                                    $mergeObjects: ["$$a", { socialMedia: "instagram" }],
                                                },
                                            },
                                        },
                                        {
                                            $map: {
                                                input: { $ifNull: ["$tiktok", []] },
                                                as: "a",
                                                in: {
                                                    $mergeObjects: ["$$a", { socialMedia: "tiktok" }],
                                                },
                                            },
                                        },
                                        {
                                            $map: {
                                                input: { $ifNull: ["$spotify", []] },
                                                as: "a",
                                                in: {
                                                    $mergeObjects: ["$$a", { socialMedia: "spotify" }],
                                                },
                                            },
                                        },
                                        {
                                            $map: {
                                                input: { $ifNull: ["$soundcloud", []] },
                                                as: "a",
                                                in: {
                                                    $mergeObjects: ["$$a", { socialMedia: "soundcloud" }],
                                                },
                                            },
                                        },
                                        {
                                            $map: {
                                                input: { $ifNull: ["$facebook", []] },
                                                as: "a",
                                                in: {
                                                    $mergeObjects: ["$$a", { socialMedia: "facebook" }],
                                                },
                                            },
                                        },
                                        {
                                            $map: {
                                                input: { $ifNull: ["$youtube", []] },
                                                as: "a",
                                                in: {
                                                    $mergeObjects: ["$$a", { socialMedia: "youtube" }],
                                                },
                                            },
                                        },
                                        {
                                            $map: {
                                                input: { $ifNull: ["$press", []] },
                                                as: "a",
                                                in: {
                                                    $mergeObjects: ["$$a", { socialMedia: "press" }],
                                                },
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                        {
                            $project: {
                                account: {
                                    $first: {
                                        $filter: {
                                            input: "$allAccounts",
                                            as: "acc",
                                            cond: {
                                                $and: [
                                                    { $eq: ["$$acc._id", "$$accountId"] },
                                                    { $ne: ["$$acc.isHidden", true] },
                                                    { $ne: ["$$acc.isDeleted", true] },
                                                ],
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                socialAccountId: {
                                    $cond: [
                                        { $ifNull: ["$account._id", false] },
                                        { $toString: "$account._id" },
                                        null,
                                    ],
                                },
                                username: "$account.username",
                                logoUrl: "$account.logoUrl",
                                followers: { $ifNull: ["$account.followers", 0] },
                                price: { $ifNull: ["$account.publicPrice", 0] },
                                socialMedia: "$account.socialMedia",
                            },
                        },
                    ],
                    as: "accountMeta",
                },
            },

            {
                $addFields: {
                    accountMeta: { $first: "$accountMeta" },
                },
            },

            {
                $addFields: {
                    addedAccountDetailed: {
                        $cond: [
                            { $ifNull: ["$addedAccounts", false] },
                            {
                                influencerId: { $toString: "$addedAccounts.influencerId" },
                                socialAccountId: { $toString: "$addedAccounts.accountId" },
                                socialMedia: "$addedAccounts.socialMedia",
                                username: {
                                    $ifNull: ["$accountMeta.username", "[not found]"],
                                },
                                logoUrl: {
                                    $ifNull: ["$accountMeta.logoUrl", ""],
                                },
                                followers: {
                                    $ifNull: ["$accountMeta.followers", 0],
                                },
                                price: {
                                    $ifNull: ["$accountMeta.price", 0],
                                },
                                selectedContent: {
                                    $cond: [
                                        { $ifNull: ["$addedAccounts.selectedContent", false] },
                                        {
                                            campaignContentItemId: {
                                                $toString: "$addedAccounts.selectedContent.campaignContentItemId",
                                            },
                                            descriptionId: {
                                                $toString: "$addedAccounts.selectedContent.descriptionId",
                                            },
                                        },
                                        "$$REMOVE",
                                    ],
                                },
                            },
                            "$$REMOVE",
                        ],
                    },
                },
            },

            {
                $group: {
                    _id: "$_id",
                    step: { $first: "$latestStep" },
                    socialMedia: { $first: "$socialMedia" },
                    campaignName: { $first: "$campaignName" },
                    campaignContent: { $first: "$campaignContent" },
                    addedAccounts: { $push: "$addedAccountDetailed" },
                },
            },

            {
                $addFields: {
                    addedAccounts: {
                        $filter: {
                            input: "$addedAccounts",
                            as: "acc",
                            cond: { $ne: ["$$acc", null] },
                        },
                    },
                },
            },

            {
                $addFields: {
                    totalPrice: {
                        $sum: {
                            $map: {
                                input: "$addedAccounts",
                                as: "acc",
                                in: { $ifNull: ["$$acc.price", 0] },
                            },
                        },
                    },
                },
            },

            {
                $project: {
                    _id: { $toString: "$_id" },
                    step: 1,
                    socialMedia: 1,
                    addedAccounts: 1,
                    campaignName: 1,
                    campaignContent: 1,
                    totalPrice: 1,
                },
            },
        ];

        const [draft] = await this.draftCampaign.aggregate<DetailedDraftCampaignDto>(pipeline);

        return draft ?? null;
    }
}