import {BaseRepository} from "../base.repository";
import {CampaignAction, InfluencerActionsHistory} from "../../schemas/histories/influencer-actions-history.schema";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";
import {RepoOptions} from "../../types/repo.types";
import {applyQueryOptions} from "../../utils/apply-query-options.util";
import {SocialMediaType} from "../../../common/types/social-media.types";
import {CampaignActionWithCampaignMeta} from "../../../modules/influencer-actions-history/types/influencer-history.types";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {IInfluencerHistory, InfluencerHistoryActionType} from "../../../common/types/history.types";

// Interface for influencer history repository
interface IInfluencerHistoryRepository {
    // Find all campaign actions for specific social account (by social account's username, social media, influencer's id)
    findCampaignActionsForSocialAccount(
        request: {
            influencerId: string;
            socialAccountUsername: string;
            socialMedia: SocialMediaType;
        },
        options?: RepoOptions,
    ): Promise<CampaignActionWithCampaignMeta[]>;

    // Get paginated actions history
    findPaginated(
        influencerId: string,
        query: PaginationQueryDto
    ): Promise<{
        history: IInfluencerHistory;
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    } | null>
}

@Injectable()
export class InfluencerHistoryRepository extends BaseRepository<InfluencerActionsHistory> implements IInfluencerHistoryRepository {
    constructor(
        @InjectModel(InfluencerActionsHistory.name)
        private readonly influencerHistoryModel: Model<InfluencerActionsHistory>,
    ) {
        super(influencerHistoryModel);
    }

    async findCampaignActionsForSocialAccount(
        request: {
            influencerId: string;
            socialAccountUsername: string;
            socialMedia: SocialMediaType;
        },
        options?: RepoOptions,
    ): Promise<CampaignActionWithCampaignMeta[]> {

        const pipeline: any[] = [
            {
                $match: {
                    influencerId: new Types.ObjectId(request.influencerId),
                },
            },
            { $unwind: '$campaigns' },
            { $unwind: '$campaigns.actions' },
            {
                $match: {
                    'campaigns.actions.networkUsername': request.socialAccountUsername,
                    'campaigns.actions.socialMedia': request.socialMedia,
                },
            },
            {
                $project: {
                    _id: 0,

                    // campaign meta data
                    campaignId: '$campaigns.campaignId',
                    campaignName: '$campaigns.campaignName',

                    // action data
                    action: '$campaigns.actions',
                },
            },
            {
                // union campaign meta + action
                $replaceRoot: {
                    newRoot: {
                        $mergeObjects: ['$action', {
                            campaignId: '$campaignId',
                            campaignName: '$campaignName',
                        }],
                    },
                },
            },
        ];

        const query = this.influencerHistoryModel.aggregate<CampaignActionWithCampaignMeta>(pipeline);

        return applyQueryOptions(query, options);
    }

    async findPaginated(
        influencerId: string,
        query: PaginationQueryDto,
    ): Promise<{
        history: IInfluencerHistory;
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    } | null> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;

        const result = await this.influencerHistoryModel.aggregate([
            {
                $match: {
                    influencerId: new Types.ObjectId(influencerId),
                },
            },
            {
                $project: {
                    influencerId: 1,
                    influencerEmail: 1,

                    allActions: {
                        $concatArrays: [
                            {
                                $reduce: {
                                    input: {
                                        $map: {
                                            input: '$campaigns',
                                            as: 'campaign',
                                            in: {
                                                $map: {
                                                    input: '$$campaign.actions',
                                                    as: 'action',
                                                    in: {
                                                        _id: '$$action._id',
                                                        type: InfluencerHistoryActionType.campaign,
                                                        campaignId: '$$campaign.campaignId',
                                                        addedAccountsId: '$$action.addedAccountsId',
                                                        socialAccountId: '$$action.socialAccountId',
                                                        socialMedia: '$$action.socialMedia',
                                                        username: '$$action.networkUsername',
                                                        campaignName: '$$campaign.campaignName',
                                                        reward: '$$action.rewardForInfluencer',
                                                        actionNumber: '$$action.actionNumber',
                                                        currentBalance: '$$action.currentBalance',
                                                        date: '$$action.date',
                                                        isStillInCampaign: '$$action.isStillInCampaign',
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    initialValue: [],
                                    in: {
                                        $concatArrays: ['$$value', '$$this'],
                                    },
                                },
                            },
                            {
                                $map: {
                                    input: '$invoices',
                                    as: 'invoice',
                                    in: {
                                        _id: '$$invoice._id',
                                        type: InfluencerHistoryActionType.invoice,
                                        invoiceId: '$$invoice.invoiceId',
                                        amount: '$$invoice.amount',
                                        paymentMethod: '$$invoice.paymentMethod',
                                        currentBalance: '$$invoice.currentBalance',
                                        date: '$$invoice.date',
                                    },
                                },
                            },
                        ],
                    },
                },
            },
            {
                $unwind: '$allActions',
            },
            {
                $sort: {
                    'allActions.date': -1,
                },
            },
            {
                $facet: {
                    metadata: [
                        {
                            $group: {
                                _id: '$_id',
                                influencerId: { $first: '$influencerId' },
                                influencerEmail: { $first: '$influencerEmail' },
                                total: { $sum: 1 },
                            },
                        },
                    ],
                    items: [
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $group: {
                                _id: '$_id',
                                actions: { $push: '$allActions' },
                            },
                        },
                    ],
                },
            },
        ]);

        if (!result.length || !result[0].metadata.length) {
            return null;
        }

        const meta = result[0].metadata[0];
        const items = result[0].items[0]?.actions ?? [];
        const total = meta.total;

        if (!meta._id || items.length === 0) {
            return null;
        }

        return {
            history: {
                _id: meta._id,
                influencerId: new Types.ObjectId(influencerId),
                influencerEmail: meta.influencerEmail ?? "No email",
                actions: items
            },
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
}