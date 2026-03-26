import {BaseRepository} from "../base.repository";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, PipelineStage, Query, Types} from "mongoose";
import {RepoOptions} from "../../types/repo.types";
import {applyQueryOptions} from "../../utils/apply-query-options.util";
import {ProposalCampaign} from "../../schemas/campaign/proposal-campaign.schema";
import {Role} from "../../../common/types/user.types";
import {
    CampaignConfirmationEnum,
    CampaignStatusEnum, IAdminCampaignForList,
    IDashboardCampaign
} from "../../../common/types/client/campaign.types";
import {Campaign} from "../../schemas/campaign/campaign.schema";
import {ProposalCampaignOption} from "../../schemas/campaign/proposal-campaign-option.schema";
import {GetAdminCampaignsListQueryDto} from "../../../modules/admin/dto/campaigns/admin-campaigns.dto";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";

// Interface for proposal campaigns repository
interface IProposalCampaignRepository {
    // Get paginated list of dashboard campaigns
    getDashboardCampaigns(
        clientId: string,
        limit: number,
        skip: number,
    ): Promise<IDashboardCampaign[]>;

    // Aggregation for fetching proposal campaigns for admin panel
    getProposalCampaignsForAdmin(
        query: GetAdminCampaignsListQueryDto | SearchQueryDto,
        take: number
    ): Promise<{
        items: IAdminCampaignForList[];
        total: number;
    }>
}

@Injectable()
export class ProposalCampaignRepository extends BaseRepository<ProposalCampaign> implements IProposalCampaignRepository {
    constructor(
        @InjectModel(ProposalCampaign.name)
        private readonly proposalCampaignModel: Model<ProposalCampaign>,
        @InjectModel(ProposalCampaignOption.name)
        private readonly proposalOptionModel: Model<ProposalCampaignOption>,
    ) {
        super(proposalCampaignModel);
    }

    async getDashboardCampaigns(
        clientId: string,
        limit: number = 10,
        skip: number = 0,
    ): Promise<IDashboardCampaign[]> {
        const proposalCampaigns: ProposalCampaign[] = await this.proposalCampaignModel
            .find(
                {
                    $or: [
                        {creatorId: new Types.ObjectId(clientId)},
                        {clientId: new Types.ObjectId(clientId)}
                    ]
                }
            )
            .lean()
            .limit(limit)
            .skip(skip)
            .exec();

        return proposalCampaigns.map((campaign: ProposalCampaign): IDashboardCampaign => ({
            _id: campaign._id,
            campaignName: campaign.campaignName,
            socialMedia: campaign.socialMedia,
            createdAt: campaign.createdAt,
            clientStatus: "proposal"
        }));
    }

    async getProposalCampaignsForAdmin(query: GetAdminCampaignsListQueryDto | SearchQueryDto, take: number): Promise<{
        items: IAdminCampaignForList[];
        total: number
    }> {
        const rawSearch = (query as any).search?.trim();

        const escapedSearch = rawSearch
            ? rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            : null;

        // match stage for search
        const matchStage: PipelineStage.Match | null = escapedSearch
            ? {
                $match: {
                    campaignName: { $regex: escapedSearch, $options: 'i' },
                },
            }
            : null;

        const basePipeline: PipelineStage[] = [
            ...(matchStage ? [matchStage] : []),

            { $sort: { createdAt: -1, _id: -1 } },
            { $limit: take },

            {
                $lookup: {
                    from: 'clients',
                    let: {
                        creatorId: '$creatorId',
                        creatorRole: '$creatorRole',
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$$creatorRole', Role.admin] },
                                        { $eq: ['$_id', '$$creatorId'] },
                                    ],
                                },
                            },
                        },
                        {
                            $project: {
                                _id: 1,
                                firstName: 1,
                                role: 1,
                            },
                        },
                    ],
                    as: 'client',
                },
            },
            {
                $unwind: {
                    path: '$client',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $project: {
                    _id: 1,
                    socialMedia: 1,
                    campaignName: 1,
                    creatorRole: 1,
                    creatorName: '$client.firstName',
                    totalFollowers: 1,
                    price: 1,
                    publicPrice: 1,
                    createdAt: 1,
                    status: 'proposal',
                    reportSent: { $ifNull: ['$adminMeta.reportSent', false] },
                    paymentStatus: 1,
                    invoiceId: 1,
                    shortInvoiceId: 1,
                    notes: '$adminMeta.notes',
                    affiliatePartner: '$adminMeta.affiliatePartner',
                    affiliateCommission: '$adminMeta.affiliateCommission',
                    affiliatePaid: '$adminMeta.affiliatePaid',
                },
            },
        ];

        const totalPipeline: PipelineStage[] = [
            ...(matchStage ? [matchStage] : []),
            { $count: 'total' },
        ];

        const [items, totalResult] = await Promise.all([
            this.proposalCampaignModel.aggregate<IAdminCampaignForList>(basePipeline),
            this.proposalCampaignModel.aggregate<{ total: number }>(totalPipeline),
        ]);

        const total = totalResult[0]?.total ?? 0;

        return {
            items,
            total,
        };
    }
}