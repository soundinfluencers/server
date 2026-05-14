import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {RequestForAdmin} from "../../schemas/requests/request-for-admin.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Document, Model, PipelineStage, Types} from "mongoose";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {IAdminRequest} from "../../../common/types/request-for-admin/request-for-admin.types";
import {NewClientAdminRequest, NewClientAdminRequestDocument} from "../../schemas/requests/new-client-request.schema";

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
    getNewClientRequestDetails(requestId: string): Promise<NewClientAdminRequestDocument | null>;
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
                    type: 1,
                    status: 1,
                    userFirstName: 1,
                    userRole: 1,
                    createdAt: 1,
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
    async getPaginatedList(query: PaginationQueryDto): Promise<{ items: IAdminRequest[]; total: number; page: number; limit: number; totalPages: number; }> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            this.requestForAdmin.aggregate<IAdminRequest>([
                {$sort: {createdAt: -1}},
                {$skip: skip},
                {$limit: limit},

                {
                    $project: {
                        _id: 1,
                        type: 1,
                        status: 1,
                        userFirstName: 1,
                        userRole: 1,
                        createdAt: 1,
                    }
                }
            ]),
            this.requestForAdmin.countDocuments()
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
    async getNewClientRequestDetails(requestId: string): Promise<NewClientAdminRequestDocument | null> {
        // Aggregation with lookup for getting
    }
}