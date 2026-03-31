import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {CompletedCampaign} from "../../schemas/campaign/completed-campaign.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Model, PipelineStage, Types} from "mongoose";
import {
    AdminCampaignStatusEnum,
    CampaignAdminMetaEnum, CampaignStatusEnum, IAdminCampaignDetails, IAdminCampaignForList,
    ICampaignDetails,
    IDashboardCampaign
} from "../../../common/types/client/campaign.types";
import {Campaign} from "../../schemas/campaign/campaign.schema";
import {mapSchemaToIAdminCampaignDetails, mapSchemaToICampaignDetails} from "../../../common/mappers/campaign.mapper";
import {
    AdminCampaignsListStatusEnum,
    GetAdminCampaignsListQueryDto
} from "../../../modules/admin/dto/campaigns/admin-campaigns.dto";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {ObjId} from "../../../common/types/base.types";

// Interface for completed campaigns repository
interface ICompletedCampaignRepository {
    // Get paginated list of dashboard completed campaigns
    getDashboardCampaigns(
        clientId: string,
        limit: number,
        skip: number,
    ): Promise<IDashboardCampaign[]>;

    // Get detailed campaign information
    getDetailedCampaign(
        clientId: string,
        campaignId: string,
    ): Promise<ICampaignDetails>;

    // Aggregation for fetching completed campaigns for admin panel
    getCompletedCampaignsForAdmin(
        query: GetAdminCampaignsListQueryDto | SearchQueryDto,
        take: number
    ): Promise<{
        items: IAdminCampaignForList[];
        total: number;
    }>

    // Update one of admin meta fields and returns IAdminCampaignForList
    updateAdminMetaField(
        campaignId: string,
        field: CampaignAdminMetaEnum,
        value: string | boolean,
    ): Promise<CompletedCampaign | null>;
}

@Injectable()
export class CompletedCampaignRepository extends BaseRepository<CompletedCampaign> implements ICompletedCampaignRepository {
    constructor(
        @InjectModel(CompletedCampaign.name)
        private readonly completedCampaignModel: Model<CompletedCampaign>
    ) {
        super(completedCampaignModel);
    }

    async getDashboardCampaigns(
        clientId: string,
        limit: number = 10,
        skip: number = 0,
    ): Promise<IDashboardCampaign[]> {
        const campaigns: Campaign[] = await this.completedCampaignModel
            .find({
                $or: [
                    {clientId: new Types.ObjectId(clientId)},
                    {userId: new Types.ObjectId(clientId)},
                ],
            })
            .lean()
            .limit(limit)
            .skip(skip)
            .exec();

        return campaigns.map((campaign: Campaign): IDashboardCampaign => ({
            _id: campaign._id,
            campaignName: campaign.campaignName,
            socialMedia: campaign.socialMedia,
            createdAt: campaign.createdAt,
            price: campaign.campaignPrice,
            clientStatus: "closed"
        }));
    }

    async getDetailedCampaign(
        clientId: string,
        campaignId: string
    ): Promise<ICampaignDetails> {
        const campaign = await this.completedCampaignModel.findOne({
            _id: new Types.ObjectId(campaignId),
            clientId: new Types.ObjectId(clientId),
        })

        return mapSchemaToICampaignDetails(campaign);
    }

    async getDetailedCampaignForAdmin(
        campaignId: string,
    ): Promise<IAdminCampaignDetails> {
        const campaign = await this.completedCampaignModel.findOne({
            _id: new Types.ObjectId(campaignId),
        })

        return mapSchemaToIAdminCampaignDetails(campaign);
    }

    async getCompletedCampaignsForAdmin(
        query: GetAdminCampaignsListQueryDto | SearchQueryDto,
        take: number,
    ): Promise<{
        items: IAdminCampaignForList[];
        total: number;
    }> {
        const rawSearch = (query as any).search?.trim();

        const escapedSearch = rawSearch
            ? rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            : null;

        // match stage for search
        const matchStage: PipelineStage.Match | null = escapedSearch
            ? {
                $match: {
                    campaignName: {$regex: escapedSearch, $options: 'i'},
                },
            }
            : null;

        // match stage for status
        const statusMatchStage: PipelineStage.Match | null = Object.values(CampaignStatusEnum).includes((query as any).status) ?
            {
                $match: {
                    statusCampaign: (query as any).status
                }
            }
            : null;

        const basePipeline: PipelineStage[] = [
            ...(matchStage ? [matchStage] : []),
            ...(statusMatchStage ? [statusMatchStage] : []),

            {$sort: {createdAt: -1, _id: -1}},
            {$limit: take},

            {
                $lookup: {
                    from: 'clients',
                    let: {clientId: '$clientId'},
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ['$_id', '$$clientId'],
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
                    creatorRole: '$client.role',
                    creatorName: '$client.firstName',
                    totalFollowers: 1,
                    price: { $sum: '$addedAccounts.price' },
                    publicPrice: '$campaignPrice',
                    createdAt: 1,
                    status: AdminCampaignsListStatusEnum.completed,
                    statusLabel: AdminCampaignStatusEnum.completed,
                    reportSent: {$ifNull: ['$adminMeta.reportSent', false]},
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
            ...(statusMatchStage ? [statusMatchStage] : []),
            {$count: 'total'},
        ];

        const [items, totalResult] = await Promise.all([
            this.completedCampaignModel.aggregate<IAdminCampaignForList>(basePipeline),
            this.completedCampaignModel.aggregate<{ total: number }>(totalPipeline),
        ]);

        const total = totalResult[0]?.total ?? 0;

        return {
            items,
            total,
        };
    }

    async updateAdminMetaField(
        campaignId: string,
        field: CampaignAdminMetaEnum,
        value: string | boolean,
    ): Promise<CompletedCampaign | null> {
        return this.completedCampaignModel
            .findByIdAndUpdate(
                new ObjId(campaignId),
                {
                    $set: {
                        [`adminMeta.${field}`]: value,
                    },
                },
                { new: true },
            )
            .lean();
    }
}