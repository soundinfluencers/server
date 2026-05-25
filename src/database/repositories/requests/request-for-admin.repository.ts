import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {RequestForAdmin, RequestForAdminDocument} from "../../schemas/requests/request-for-admin.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Document, FilterQuery, Model, PipelineStage, Types} from "mongoose";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {
    IAdminRequest, NewClientRequestDetails, RequestSpecifiedStatus,
    RequestForAdminType,
    RequestLifecycleState
} from "../../../common/types/request-for-admin/request-for-admin.types";
import {NewClientAdminRequest, NewClientAdminRequestDocument} from "../../schemas/requests/new-client-request.schema";
import {Role} from "../../../common/types/user.types";
import {AdminRequestsQueryDto} from "../../../modules/admin/dto/requests/admin-requests.dto";

// Interface for admin requests repository
interface IRequestForAdminRepository {
    // Search for admin requests
    search(query: SearchQueryDto): Promise<{
        items: IAdminRequest[];
        total: number;
        limit: number;
    }>;

    // Get paginated list of admin requests
    getPaginatedList(query: PaginationQueryDto): Promise<{
        items: IAdminRequest[],
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;

    // Get details of NEW_CLIENT_REQUEST request
    getNewClientRequestDetails(
        requestId: string,
    ): Promise<NewClientRequestDetails | null>;
}

@Injectable()
export class RequestForAdminRepository extends BaseRepository<RequestForAdmin> implements IRequestForAdminRepository {
    constructor(
        @InjectModel(RequestForAdmin.name)
        private readonly requestForAdmin: Model<RequestForAdmin>,
    ) {
        super(requestForAdmin);
    }

    // Search for admin requests
    async search(query: SearchQueryDto): Promise<{ items: IAdminRequest[]; total: number; limit: number; }> {
        const limit = query.limit ?? 10;
        const rawSearch = query.search?.trim();

        const escapedSearch = rawSearch
            ? rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            : null;

        const matchStage = escapedSearch
            ? {
                $match: {
                    $or: [
                        {userFirstName: {$regex: escapedSearch, $options: 'i'}},
                        {userRole: {$regex: escapedSearch, $options: 'i'}},
                    ],
                },
            }
            : null;

        const basePipeline: PipelineStage[] = [
            ...(matchStage ? [matchStage] : []),

            {$sort: {createdAt: -1}},
            {$limit: limit},

            {
                $project: {
                    _id: 1,
                    group: 1,
                    type: 1,
                    lifecycleStatus: 1,
                    userFirstName: 1,
                    userRole: 1,
                    createdAt: 1,
                    state: 1,
                    specifiedStatus: 1,
                }
            }
        ];

        const totalPipeline: PipelineStage[] = [
            ...(matchStage ? [matchStage] : []),
            {$count: 'total'},
        ];

        const [items, totalResult] = await Promise.all([
            this.requestForAdmin.aggregate<IAdminRequest>(basePipeline),
            this.requestForAdmin.aggregate(totalPipeline),
        ]);

        const total = totalResult[0]?.total ?? 0;

        return {
            items,
            total,
            limit
        }
    }

    // Get paginated list of admin requests
    async getPaginatedList(query: AdminRequestsQueryDto): Promise<{
        items: IAdminRequest[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;

        const filter: FilterQuery<RequestForAdminDocument> = {};

        if (query.group) {
            filter.group = query.group;
        }

        const [items, total] = await Promise.all([
            this.requestForAdmin.aggregate<IAdminRequest>([
                {
                    $match: filter,
                },
                {$sort: {createdAt: -1}},
                {$skip: skip},
                {$limit: limit},

                {
                    $project: {
                        _id: 1,
                        group: 1,
                        type: 1,
                        lifecycleStatus: 1,
                        userFirstName: 1,
                        userRole: 1,
                        createdAt: 1,
                        state: 1,
                        specifiedStatus: 1,
                    }
                }
            ]),
            this.requestForAdmin.countDocuments(filter)
        ])

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        }
    }

    // Get details of NEW_CLIENT_REQUEST request
    async getNewClientRequestDetails(
        requestId: string,
    ): Promise<NewClientRequestDetails | null> {
        if (!Types.ObjectId.isValid(requestId)) {
            return null;
        }

        const [result] = await this.requestForAdmin.aggregate<NewClientRequestDetails>([
            {
                $match: {
                    _id: new Types.ObjectId(requestId),
                    type: RequestForAdminType.NEW_CLIENT_REQUEST,
                },
            },
            {
                $lookup: {
                    from: 'clients',
                    localField: 'clientId',
                    foreignField: '_id',
                    as: 'clientInfo',
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                lastName: 1,
                                email: 1,
                                phone: 1,
                                company: 1,
                                companyType: 1,
                                referalCode: 1,
                            },
                        },
                    ],
                },
            },
            {
                $unwind: {
                    path: '$clientInfo',
                    preserveNullAndEmptyArrays: false,
                },
            },
            {
                $project: {
                    _id: 1,
                    type: 1,
                    state: 1,
                    userFirstName: 1,
                    userRole: 1,
                    reviewedAt: 1,
                    adminNote: 1,
                    createdAt: 1,
                    updatedAt: 1,

                    status: 1,
                    clientId: 1,
                    rejectionReason: 1,

                    lastName: {
                        $ifNull: ['$clientInfo.lastName', ''],
                    },
                    phone: {
                        $ifNull: ['$clientInfo.phone', ''],
                    },
                    email: {
                        $ifNull: ['$clientInfo.email', ''],
                    },
                    company: {
                        $ifNull: ['$clientInfo.company', ''],
                    },
                    companyType: {
                        $ifNull: ['$clientInfo.companyType', ''],
                    },

                    referralCode: {
                        $ifNull: ['$clientInfo.referalCode', ''],
                    },
                },
            },
        ]);

        return result ?? null;
    }
}