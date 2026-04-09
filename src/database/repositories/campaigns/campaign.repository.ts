import {BaseRepository} from "../base.repository";
import {Campaign, CampaignAccount} from "../../schemas/campaign/campaign.schema";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {ClientSession, Model, PipelineStage, Types} from "mongoose";
import {RepoOptions} from "../../types/repo.types";
import {CompletedCampaign} from "../../schemas/campaign/completed-campaign.schema";
import {ObjId} from "../../../common/types/base.types";
import {
    InfluencerConfirmationStatusEnum,
    InfluencerPromoClosedStatusEnum
} from "../../../common/types/influencer/promo.types";
import {InvoiceStatusEnum} from "../../../common/types/invoice.types";
import {
    AdminCampaignStatusEnum,
    CampaignAdminMetaEnum,
    CampaignConfirmationEnum,
    CampaignStatusEnum, IAdminCampaignDetails,
    IAdminCampaignForList,
    ICampaignDetails,
    IDashboardCampaign
} from "../../../common/types/client/campaign.types";
import {mapSchemaToIAdminCampaignDetails, mapSchemaToICampaignDetails} from "../../../common/mappers/campaign.mapper";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {
    AdminCampaignsListStatusEnum,
    GetAdminCampaignsListQueryDto
} from "../../../modules/admin/dto/campaigns/admin-campaigns.dto";

// Interface for campaign repository
export interface ICampaignRepository {
    // Get paginated list of dashboard campaigns
    getDashboardCampaigns(
        clientId: string,
        limit: number,
        skip: number,
        statusCampaign: CampaignStatusEnum[],
        verifyCampaign: CampaignConfirmationEnum,
    ): Promise<IDashboardCampaign[]>;

    // Get detailed campaign information
    getDetailedCampaign(
        clientId: string,
        campaignId: string,
    ): Promise<ICampaignDetails>;

    // Replace influencer id in each influencer's promo
    replaceInfluencerId(oldInfluencerId: string, newInfluencerId: string, options?: RepoOptions): Promise<any>;

    // Find all influencer's promos that were closed and waiting for payment
    findAllWaitingForPayment(influencerId: string, invoiceStatus: InvoiceStatusEnum, session?: ClientSession): Promise<CampaignAccount[]>;

    // Find influencer's promos by invoice status and update this status
    updateManyInvoiceStatuses(influencerId: string, oldInvoiceStatus: InvoiceStatusEnum, newInvoiceStatus: InvoiceStatusEnum, session?: ClientSession): Promise<any>;

    // Check if social account still in campaign
    checkIfAccountStillInCampaign(campaignId: string, addedAccountsId: string): Promise<boolean>;

    // Aggregation for fetching ongoing campaigns for admin panel
    getOngoingCampaignsForAdmin(
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
    ): Promise<Campaign | null>;
}

@Injectable()
export class CampaignRepository extends BaseRepository<Campaign> implements ICampaignRepository {
    constructor(
        @InjectModel(Campaign.name)
        private readonly campaignModel: Model<Campaign>,
        @InjectModel(CompletedCampaign.name)
        private readonly completedCampaignModel: Model<CompletedCampaign>,
    ) {
        super(campaignModel);
    }

    async getDashboardCampaigns(
        clientId: string,
        limit: number = 10,
        skip: number = 0,
        statusCampaign: CampaignStatusEnum[],
        verifyCampaign: CampaignConfirmationEnum,
    ): Promise<IDashboardCampaign[]> {
        const campaigns: Campaign[] = await this.campaignModel
            .find({
                clientId: new Types.ObjectId(clientId),
                statusCampaign: {$in: statusCampaign},
                verifyCampaign,
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
            clientStatus: verifyCampaign === CampaignConfirmationEnum.accept
                ? "distributing" : verifyCampaign === CampaignConfirmationEnum.wait
                    ? "under_review" : "declined"
        }));
    }

    async getDetailedCampaign(
        clientId: string,
        campaignId: string
    ): Promise<ICampaignDetails> {
        const campaign = await this.campaignModel.findOne({
            _id: new Types.ObjectId(campaignId),
            clientId: new Types.ObjectId(clientId),
        })

        if (!campaign) return null;

        return mapSchemaToICampaignDetails(campaign);
    }

    async getDetailedCampaignForAdmin(
        campaignId: string,
    ): Promise<IAdminCampaignDetails> {
        const campaign = await this.campaignModel.findOne({
            _id: new Types.ObjectId(campaignId),
        })

        return mapSchemaToIAdminCampaignDetails(campaign);
    }

    async replaceInfluencerId(
        oldInfluencerId: string,
        newInfluencerId: string,
        options?: RepoOptions,
    ) {
        return this.campaignModel.updateMany(
            {
                'selectInfluencers.influencerId': new Types.ObjectId(oldInfluencerId),
            },
            {
                $set: {
                    'selectInfluencers.$[elem].influencerId':
                        new Types.ObjectId(newInfluencerId),
                },
            },
            {
                arrayFilters: [
                    {'elem.influencerId': new Types.ObjectId(oldInfluencerId)},
                ],
            },
        );
    }

    async findAllWaitingForPayment(
        influencerId: string,
        invoiceStatus: InvoiceStatusEnum,
        session?: ClientSession
    ): Promise<(CampaignAccount & { campaignId: Types.ObjectId, campaignName: string })[]> {
        const _id = new ObjId(influencerId);

        const pipeline = [
            {
                $match: {
                    addedAccounts: {
                        $elemMatch: {
                            influencerId: _id,
                            confirmation: InfluencerConfirmationStatusEnum.accept,
                            closePromo: InfluencerPromoClosedStatusEnum.close,
                            invoiceStatus: invoiceStatus,
                        },
                    },
                },
            },
            {
                $project: {
                    campaignId: "$_id",
                    campaignName: "$campaignName",
                    addedAccounts: {
                        $filter: {
                            input: "$addedAccounts",
                            as: "account",
                            cond: {
                                $and: [
                                    {$eq: ["$$account.influencerId", _id]},
                                    {$eq: ["$$account.confirmation", InfluencerConfirmationStatusEnum.accept]},
                                    {$eq: ["$$account.closePromo", InfluencerPromoClosedStatusEnum.close]},
                                    {$eq: ["$$account.invoiceStatus", invoiceStatus]},
                                ],
                            },
                        },
                    },
                },
            },
            {$unwind: "$addedAccounts"},
            {
                $replaceRoot: {
                    newRoot: {
                        $mergeObjects: [
                            "$addedAccounts",
                            {campaignId: "$campaignId"},
                            {campaignName: "$campaignName"},
                        ],
                    },
                },
            },
        ] satisfies PipelineStage[];

        const [ongoingPromos, completedPromos] = await Promise.all([
            this.campaignModel
                .aggregate<CampaignAccount & { campaignId: Types.ObjectId, campaignName: string }>(pipeline)
                .session(session ?? null),

            this.completedCampaignModel
                .aggregate<CampaignAccount & { campaignId: Types.ObjectId, campaignName: string }>(pipeline)
                .session(session ?? null),
        ]);

        return [...ongoingPromos, ...completedPromos];
    }

    async updateManyInvoiceStatuses(
        influencerId: string,
        oldInvoiceStatus: InvoiceStatusEnum,
        newInvoiceStatus: InvoiceStatusEnum,
        session?: ClientSession
    ): Promise<void> {
        const _id = new ObjId(influencerId);

        const elemMatch = {
            influencerId: _id,
            confirmation: InfluencerConfirmationStatusEnum.accept,
            closePromo: InfluencerPromoClosedStatusEnum.close,
            invoiceStatus: oldInvoiceStatus,
        };

        const update = {
            $set: {
                'addedAccounts.$[elem].invoiceStatus': newInvoiceStatus,
            },
        };

        const options = {
            session,
            arrayFilters: [
                {
                    'elem.influencerId': _id,
                    'elem.confirmation': InfluencerConfirmationStatusEnum.accept,
                    'elem.closePromo': InfluencerPromoClosedStatusEnum.close,
                    'elem.invoiceStatus': oldInvoiceStatus,
                },
            ],
        };

        await Promise.all([
            this.campaignModel.updateMany(
                {addedAccounts: {$elemMatch: elemMatch}},
                update,
                options
            ),
            this.completedCampaignModel.updateMany(
                {addedAccounts: {$elemMatch: elemMatch}},
                update,
                options
            ),
        ]);
    }

    async checkIfAccountStillInCampaign(
        campaignId: string,
        addedAccountsId: string,
    ): Promise<boolean> {
        let exists = await this.campaignModel.exists({
            _id: new ObjId(campaignId),
            'addedAccounts._id': new ObjId(addedAccountsId),
        });

        if (!exists) {
            exists = await this.completedCampaignModel.exists({
                _id: new ObjId(campaignId),
                'addedAccounts._id': new ObjId(addedAccountsId),
            });
        }

        return !!exists;
    }

    async getOngoingCampaignsForAdmin(
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
                $lookup: {
                    from: 'userinvoices',
                    let: { campaignId: '$_id' },
                    pipeline: [
                        {
                            $setWindowFields: {
                                sortBy: { _id: 1 },
                                output: {
                                    shortInvoiceNumber: { $documentNumber: {} }
                                }
                            }
                        },
                        {
                            $match: {
                                $expr: { $eq: ['$campaignId', '$$campaignId'] }
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                shortInvoiceNumber: 1
                            }
                        }
                    ],
                    as: 'userInvoice'
                }
            },
            {
                $unwind: {
                    path: '$userInvoice',
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $project: {
                    _id: 1,
                    socialMedia: 1,
                    campaignName: 1,
                    creatorRole: '$client.role',
                    creatorName: '$client.firstName',
                    totalFollowers: { $sum: '$addedAccounts.followers' },
                    price: { $sum: '$addedAccounts.price' },
                    publicPrice: '$campaignPrice',
                    createdAt: 1,
                    status: {
                        $cond: [
                            { $eq: ['$statusCampaign', 'distributing'] },
                            AdminCampaignsListStatusEnum.distributing,
                            AdminCampaignsListStatusEnum.pending,
                        ],
                    },
                    statusLabel: {
                        $cond: [
                            { $eq: ['$statusCampaign', 'distributing'] },
                            AdminCampaignStatusEnum.distributing,
                            AdminCampaignStatusEnum.pending,
                        ]
                    },
                    reportSent: {$ifNull: ['$adminMeta.reportSent', false]},
                    paymentStatus: 1,
                    invoiceId: '$userInvoice._id',
                    shortInvoiceNumber: '$userInvoice.shortInvoiceNumber',
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
            this.campaignModel.aggregate<IAdminCampaignForList>(basePipeline),
            this.campaignModel.aggregate<{ total: number }>(totalPipeline),
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
    ): Promise<Campaign | null> {
        return this.campaignModel
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