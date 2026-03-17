import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {Client} from "../../schemas/users/client.schema";
import {InjectModel} from "@nestjs/mongoose";
import {FilterQuery, Model} from "mongoose";
import {RepoOptions} from "../../types/repo.types";
import {applyQueryOptions} from "../../utils/apply-query-options.util";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {AdminClientListItem} from "../../../common/types/client/client.types";

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
        items: AdminClientListItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;

        const [items, totalResult] = await Promise.all([
            this.clientModel.aggregate<AdminClientListItem>([
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
                                    latestCampaign: {
                                        $first: {
                                            _id: '$_id',
                                            campaignName: '$campaignName',
                                        },
                                    },
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
                        latestCampaign: {
                            $ifNull: [
                                { $arrayElemAt: ['$activeCampaignStats.latestCampaign', 0] },
                                null,
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
                        latestCampaign: 1,
                        internalNote: 1,
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
}