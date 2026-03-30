import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {Client} from "../../schemas/users/client.schema";
import {InjectModel} from "@nestjs/mongoose";
import {FilterQuery, Model, PipelineStage} from "mongoose";
import {RepoOptions} from "../../types/repo.types";
import {applyQueryOptions} from "../../utils/apply-query-options.util";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {IAdminClientDetails, IAdminClientListItem} from "../../../common/types/client/client.types";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {ObjId} from "../../../common/types/base.types";

@Injectable()
export class ClientRepository extends BaseRepository<Client> {
    constructor(
        @InjectModel('Client')
        private readonly clientModel: Model<Client>,
    ) {
        super(clientModel);
    }

    // todo: for return create & use READ MODELS / MAP TO DTO instead of mongoose objects. repositories should return read models and

    async findClientByFirstName(firstName: string, options?: RepoOptions): Promise<Client> {
        const query = this.clientModel.findOne({ firstName });
        return applyQueryOptions(query, options);
    }

    async findClientByEmail(email: string, options?: RepoOptions): Promise<Client> {
        const query = this.clientModel.findOne({ email });
        return applyQueryOptions(query, options);
    }

    async findClientByInstagramUsername(username: string, options?: RepoOptions): Promise<Client> {
        const query = this.clientModel.findOne({ instagramUsername: username });
        return applyQueryOptions(query, options);
    }

    async findClientByPhone(phone: string, options?: RepoOptions): Promise<Client> {
        const query = this.clientModel.findOne({ phone })
        return applyQueryOptions(query, options);
    }

    async findPaginated(
        query: PaginationQueryDto,
    ): Promise<{
        items: IAdminClientListItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;

        const [items, totalResult] = await Promise.all([
            this.clientModel.aggregate<IAdminClientListItem>([
                { $sort: { createdAt: -1 } },
                { $skip: skip },
                { $limit: limit },

                {
                    $lookup: {
                        from: 'campaigns',
                        let: { clientId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ['$clientId', '$$clientId'] },
                                },
                            },
                            { $sort: { createdAt: -1 } },
                            {
                                $group: {
                                    _id: null,
                                    campaignsActive: { $sum: 1 },
                                },
                            },
                        ],
                        as: 'activeCampaignStats',
                    },
                },

                {
                    $lookup: {
                        from: 'completedcampaigns',
                        let: { clientId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ['$clientId', '$$clientId'] },
                                },
                            },
                            {
                                $group: {
                                    _id: null,
                                    campaignsCompleted: { $sum: 1 },
                                },
                            },
                        ],
                        as: 'completedCampaignStats',
                    },
                },

                {
                    $addFields: {
                        campaignsActive: {
                            $ifNull: [
                                { $arrayElemAt: ['$activeCampaignStats.campaignsActive', 0] },
                                0,
                            ],
                        },
                        campaignsCompleted: {
                            $ifNull: [
                                { $arrayElemAt: ['$completedCampaignStats.campaignsCompleted', 0] },
                                0,
                            ],
                        },
                    },
                },

                {
                    $project: {
                        company: 1,
                        firstName: 1,
                        lastName: 1,
                        email: 1,
                        phone: 1,
                        companyType: 1,
                        _id: 1,
                        isProposal: '$isProposalClient',
                        campaignsCompleted: 1,
                        campaignsActive: 1,
                    },
                },
            ]),
            this.clientModel.aggregate([{ $count: 'total' }]),
        ]);

        const total = totalResult[0]?.total ?? 0;

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findBySearch(
        query: SearchQueryDto,
    ): Promise<{
        items: IAdminClientListItem[];
        total: number;
        limit: number;
    }> {
        const limit = query.limit ?? 10;
        const rawSearch = query.search?.trim();

        const escapedSearch = rawSearch
            ? rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            : null;

        const matchStage = escapedSearch
            ? {
                $match: {
                    $or: [
                        { firstName: { $regex: escapedSearch, $options: 'i' } },
                        { lastName: { $regex: escapedSearch, $options: 'i' } },
                        { email: { $regex: escapedSearch, $options: 'i' } },
                        { phone: { $regex: escapedSearch, $options: 'i' } },
                        { company: { $regex: escapedSearch, $options: 'i' } },
                    ],
                },
            }
            : null;

        const basePipeline: PipelineStage[] = [
            ...(matchStage ? [matchStage] : []),

            { $sort: { createdAt: -1 } },
            { $limit: limit },

            {
                $lookup: {
                    from: 'campaigns',
                    let: { clientId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$clientId', '$$clientId'] },
                            },
                        },
                        { $sort: { createdAt: -1 } },
                        {
                            $group: {
                                _id: null,
                                campaignsActive: { $sum: 1 },
                            },
                        },
                    ],
                    as: 'activeCampaignStats',
                },
            },

            {
                $lookup: {
                    from: 'completedcampaigns',
                    let: { clientId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$clientId', '$$clientId'] },
                            },
                        },
                        {
                            $group: {
                                _id: null,
                                campaignsCompleted: { $sum: 1 },
                            },
                        },
                    ],
                    as: 'completedCampaignStats',
                },
            },

            {
                $addFields: {
                    campaignsActive: {
                        $ifNull: [
                            { $arrayElemAt: ['$activeCampaignStats.campaignsActive', 0] },
                            0,
                        ],
                    },
                    campaignsCompleted: {
                        $ifNull: [
                            { $arrayElemAt: ['$completedCampaignStats.campaignsCompleted', 0] },
                            0,
                        ],
                    },
                },
            },

            {
                $project: {
                    company: 1,
                    firstName: 1,
                    lastName: 1,
                    email: 1,
                    phone: 1,
                    companyType: 1,
                    _id: 1,
                    isProposal: '$isProposalClient',
                    campaignsCompleted: 1,
                    campaignsActive: 1,
                },
            },
        ];

        const totalPipeline: PipelineStage[] = [
            ...(matchStage ? [matchStage] : []),
            { $count: 'total' },
        ];

        const [items, totalResult] = await Promise.all([
            this.clientModel.aggregate<IAdminClientListItem>(basePipeline),
            this.clientModel.aggregate(totalPipeline),
        ]);

        const total = totalResult[0]?.total ?? 0;

        return {
            items,
            total,
            limit,
        };
    }

    async getClientsDetailsForAdmin(clientId: string): Promise<IAdminClientDetails | null> {
        // limit: 10 active campaigns & 10 completed campaigns

        const _id = new ObjId(clientId);

        const basePipeline: PipelineStage[] = [
            { $match: { _id: _id } },

            {
                $lookup: {
                    from: 'campaigns',
                    let: { clientId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$clientId', '$$clientId'] },
                            },
                        },
                        { $sort: { createdAt: -1, _id: -1 } },
                        { $limit: 10 },
                        {
                            $project: {
                                _id: 1,
                                campaignName: 1,
                                socialMedia: 1,
                                createdAt: 1,
                                campaignPrice: 1,
                            },
                        },
                    ],
                    as: 'campaignsActive',
                },
            },

            {
                $lookup: {
                    from: 'completedcampaigns',
                    let: { clientId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$clientId', '$$clientId'] },
                            },
                        },
                        { $sort: { createdAt: -1, _id: -1 } },
                        { $limit: 10 },
                        {
                            $project: {
                                _id: 1,
                                campaignName: 1,
                                socialMedia: 1,
                                createdAt: 1,
                                campaignPrice: 1,
                            },
                        },
                    ],
                    as: 'campaignsCompleted',
                },
            },

            {
                $project: {
                    company: 1,
                    firstName: 1,
                    lastName: 1,
                    email: 1,
                    phone: 1,
                    companyType: 1,
                    _id: 1,
                    isProposal: '$isProposalClient',
                    campaignsCompleted: 1,
                    campaignsActive: 1,
                },
            }
        ]

        const result = await this.clientModel.aggregate<IAdminClientDetails>(basePipeline);
        const aggResult = result[0] ?? null;

        const latestCampaign = [...(aggResult.campaignsActive ?? []), ...(aggResult.campaignsCompleted ?? [])]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        const latestCampaignName = latestCampaign?.campaignName ?? null;

        return {
            ...aggResult,
            latestCampaignName: latestCampaignName
        };
    }
}