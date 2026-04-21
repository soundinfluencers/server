import {Injectable} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';
import {ClientSession, Model, PipelineStage} from 'mongoose';
import {
    UserInvoice,
    UserInvoiceDocument,
    ClientInvoiceDocument,
    InfluencerInvoiceDocument,
} from '../../schemas/invoices/user-invoice.schema';
import {Role} from '../../../common/types/user.types';
import {BaseRepository} from "../base.repository";
import {CreateCampaignInvoiceDto, CreateInvoiceDto} from "../../../modules/invoice/dto/create-invoice.dto";
import {
    mapDtoToClientInvoice, mapDtoToInfluencerInvoice,
} from "../../../common/mappers/invoice.mapper";
import {ObjId} from "../../../common/types/base.types";
import {UpdateClientInvoiceDto} from "../../../modules/invoice/dto/update-invoice.dto";
import {RepoOptions} from "../../types/repo.types";
import {applyQueryOptions} from "../../utils/apply-query-options.util";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {IAdminClientInvoice, IAdminInfluencerInvoice} from "../../../common/types/invoice.types";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";

// Interface for UserInvoiceRepository
export interface IUserInvoiceRepository {
    // Creates new client invoice (after creating new campaign). support client session
    createClientInvoice(payload: CreateCampaignInvoiceDto, session?: ClientSession): Promise<ClientInvoiceDocument>;

    // Creates new influencer invoice (with linked promos). support influencer session
    createInfluencerInvoice(payload: CreateInvoiceDto, session?: ClientSession): Promise<InfluencerInvoiceDocument>;

    // Returns one invoice that was found by _id
    findInvoiceById(invoiceId: string): Promise<ClientInvoiceDocument | InfluencerInvoiceDocument | null>;

    // Updates client's invoice fields. Finds invoice by _id and userId.
    updateClientInvoiceById(invoiceId: string, payload: UpdateClientInvoiceDto): Promise<ClientInvoiceDocument | null>;

    // Returns one invoice found by campaignId
    findInvoiceByCampaignId(campaignId: string): Promise<UserInvoiceDocument | null>;

    // Return paginated list of IAdminClientInvoice objects
    findPaginatedClientInvoices(
        query: PaginationQueryDto,
    ): Promise<{
        items: IAdminClientInvoice[] | IAdminInfluencerInvoice[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>

    // Search for invoices by query and get IAdminClientInvoice objects
    findBySearchClientInvoices(
        query: SearchQueryDto,
    ): Promise<{
        items: IAdminClientInvoice[] | IAdminInfluencerInvoice[];
        total: number;
        limit: number;
    }>

    // Return paginated list of IAdminInfluencerInvoice objects
    findPaginatedInfluencerInvoices(
        query: PaginationQueryDto,
    ): Promise<{
        items: IAdminInfluencerInvoice[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>

    // Search for invoices by query and get IAdminInfluencerInvoice objects
    findBySearchInfluencerInvoices(
        query: SearchQueryDto,
    ): Promise<{
        items: IAdminInfluencerInvoice[];
        total: number;
        limit: number;
    }>
}

@Injectable()
export class UserInvoiceRepository extends BaseRepository<UserInvoiceDocument> implements IUserInvoiceRepository {
    constructor(
        @InjectModel(UserInvoice.name)
        private readonly userInvoiceModel: Model<UserInvoiceDocument>,
        @InjectModel(Role.client)
        private readonly clientInvoiceModel: Model<ClientInvoiceDocument>,
        @InjectModel(Role.influencer)
        private readonly influencerInvoiceModel: Model<InfluencerInvoiceDocument>,
    ) {
        super(userInvoiceModel);
    }

    async createClientInvoice(
        payload: CreateCampaignInvoiceDto,
        session?: ClientSession
    ): Promise<ClientInvoiceDocument> {
        const [doc] = await this.clientInvoiceModel.create(
            [mapDtoToClientInvoice(payload)],
            {session}
        );

        return doc;
    }

    async createInfluencerInvoice(
        payload: CreateInvoiceDto,
        session?: ClientSession
    ): Promise<InfluencerInvoiceDocument> {
        const [doc] = await this.influencerInvoiceModel.create(
            [mapDtoToInfluencerInvoice(payload)],
            {session}
        )

        return doc;
    }

    async findInvoiceById(
        invoiceId: string
    ): Promise<ClientInvoiceDocument | InfluencerInvoiceDocument | null> {
        return await this.userInvoiceModel.findById(new ObjId(invoiceId)).exec() as unknown as
            ClientInvoiceDocument | InfluencerInvoiceDocument | null;
    }

    async updateClientInvoiceById(
        invoiceId: string,
        payload: UpdateClientInvoiceDto
    ): Promise<ClientInvoiceDocument | null> {
        return this.clientInvoiceModel.findByIdAndUpdate(
            new ObjId(invoiceId),
            {$set: payload},
            {new: true, runValidators: true}
        ).exec();
    }

    findInvoiceByCampaignId(
        campaignId: string,
        options?: RepoOptions & { select?: string[] },
    ): Promise<UserInvoiceDocument | null> {
        const query = this.userInvoiceModel.findOne({
            campaignId: new ObjId(campaignId),
        });

        if (options?.select?.length) {
            query.select(options.select.join(' '));
        }

        return applyQueryOptions(query, options);
    }

    async findPaginatedClientInvoices(
        query: PaginationQueryDto,
    ): Promise<{
        items: IAdminClientInvoice[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;

        const [items, totalResult] = await Promise.all([
            this.clientInvoiceModel.aggregate<IAdminClientInvoice>([
                {$sort: {createdAt: -1}},
                {$skip: skip},
                {$limit: limit},

                {
                    $project: {
                        _id: 1,
                        company: 1,
                        campaignName: 1,
                        createdAt: 1,
                        amount: 1,
                        status: 1,
                    },
                },
            ]),
            this.clientInvoiceModel.aggregate([{$count: 'total'}]),
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

    async findBySearchClientInvoices(
        query: SearchQueryDto,
    ): Promise<{
        items: IAdminClientInvoice[];
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
                        {firstName: {$regex: escapedSearch, $options: 'i'}},
                        {lastName: {$regex: escapedSearch, $options: 'i'}},
                        {company: {$regex: escapedSearch, $options: 'i'}},
                        {campaignName: {$regex: escapedSearch, $options: 'i'}},
                        {_id: {$regex: escapedSearch, $options: 'i'}},
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
                    company: 1,
                    campaignName: 1,
                    createdAt: 1,
                    amount: 1,
                    status: 1,
                },
            },
        ];

        const totalPipeline: PipelineStage[] = [
            ...(matchStage ? [matchStage] : []),
            {$count: 'total'},
        ];

        const [items, totalResult] = await Promise.all([
            this.clientInvoiceModel.aggregate<IAdminClientInvoice>(basePipeline),
            this.clientInvoiceModel.aggregate(totalPipeline),
        ]);

        const total = totalResult[0]?.total ?? 0;

        return {
            items,
            total,
            limit,
        };
    }

    async findPaginatedInfluencerInvoices(
        query: PaginationQueryDto,
    ): Promise<{
        items: IAdminInfluencerInvoice[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;

        const [items, totalResult] = await Promise.all([
            this.influencerInvoiceModel.aggregate<IAdminInfluencerInvoice>([
                { $sort: { createdAt: -1, _id: -1 } },
                { $skip: skip },
                { $limit: limit },

                {
                    $lookup: {
                        from: 'influencers',
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'userInfo',
                    },
                },

                {
                    $unwind: {
                        path: '$userInfo',
                        preserveNullAndEmptyArrays: true,
                    },
                },

                {
                    $addFields: {
                        firstSocialAccount: {
                            $ifNull: [
                                { $arrayElemAt: [{ $ifNull: ['$userInfo.instagram', []] }, 0] },
                                {
                                    $ifNull: [
                                        { $arrayElemAt: [{ $ifNull: ['$userInfo.tiktok', []] }, 0] },
                                        {
                                            $ifNull: [
                                                { $arrayElemAt: [{ $ifNull: ['$userInfo.spotify', []] }, 0] },
                                                {
                                                    $ifNull: [
                                                        { $arrayElemAt: [{ $ifNull: ['$userInfo.soundcloud', []] }, 0] },
                                                        {
                                                            $ifNull: [
                                                                { $arrayElemAt: [{ $ifNull: ['$userInfo.facebook', []] }, 0] },
                                                                {
                                                                    $ifNull: [
                                                                        { $arrayElemAt: [{ $ifNull: ['$userInfo.youtube', []] }, 0] },
                                                                        { $arrayElemAt: [{ $ifNull: ['$userInfo.press', []] }, 0] },
                                                                    ],
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },

                        socialMedia: {
                            $switch: {
                                branches: [
                                    {
                                        case: { $gt: [{ $size: { $ifNull: ['$userInfo.instagram', []] } }, 0] },
                                        then: 'instagram',
                                    },
                                    {
                                        case: { $gt: [{ $size: { $ifNull: ['$userInfo.tiktok', []] } }, 0] },
                                        then: 'tiktok',
                                    },
                                    {
                                        case: { $gt: [{ $size: { $ifNull: ['$userInfo.spotify', []] } }, 0] },
                                        then: 'spotify',
                                    },
                                    {
                                        case: { $gt: [{ $size: { $ifNull: ['$userInfo.soundcloud', []] } }, 0] },
                                        then: 'soundcloud',
                                    },
                                    {
                                        case: { $gt: [{ $size: { $ifNull: ['$userInfo.facebook', []] } }, 0] },
                                        then: 'facebook',
                                    },
                                    {
                                        case: { $gt: [{ $size: { $ifNull: ['$userInfo.youtube', []] } }, 0] },
                                        then: 'youtube',
                                    },
                                    {
                                        case: { $gt: [{ $size: { $ifNull: ['$userInfo.press', []] } }, 0] },
                                        then: 'press',
                                    },
                                ],
                                default: null,
                            },
                        },

                        paymentDetails: {
                            $ifNull: [
                                '$paypal',
                                {
                                    $ifNull: [
                                        '$ukBankTransfer',
                                        '$internationalBankTransfer',
                                    ],
                                },
                            ],
                        },
                    },
                },

                {
                    $project: {
                        _id: 1,
                        firstName: { $ifNull: ['$userInfo.firstName', null] },
                        lastName: { $ifNull: ['$userInfo.lastName', null] },
                        socialMedia: 1,
                        username: { $ifNull: ['$firstSocialAccount.username', null] },
                        createdAt: 1,
                        amount: 1,
                        paymentMethod: '$selectedPaymentMethod',
                        paymentDetails: 1,
                        status: 1,
                    },
                },
            ]),
            this.influencerInvoiceModel.aggregate([{$count: 'total'}]),
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

    async findBySearchInfluencerInvoices(
        query: SearchQueryDto,
    ): Promise<{
        items: IAdminInfluencerInvoice[];
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
                        {firstName: {$regex: escapedSearch, $options: 'i'}},
                        {lastName: {$regex: escapedSearch, $options: 'i'}},
                        {company: {$regex: escapedSearch, $options: 'i'}},
                        {_id: {$regex: escapedSearch, $options: 'i'}},
                    ],
                },
            }
            : null;

        const basePipeline: PipelineStage[] = [
            ...(matchStage ? [matchStage] : []),

            {
                $sort: { createdAt: -1, _id: -1 },
            },
            {
                $limit: limit,
            },

            {
                $lookup: {
                    from: 'influencers',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userInfo',
                },
            },

            {
                $unwind: {
                    path: '$userInfo',
                    preserveNullAndEmptyArrays: true,
                },
            },

            {
                $addFields: {
                    firstSocialAccount: {
                        $ifNull: [
                            { $arrayElemAt: [{ $ifNull: ['$userInfo.instagram', []] }, 0] },
                            {
                                $ifNull: [
                                    { $arrayElemAt: [{ $ifNull: ['$userInfo.tiktok', []] }, 0] },
                                    {
                                        $ifNull: [
                                            { $arrayElemAt: [{ $ifNull: ['$userInfo.spotify', []] }, 0] },
                                            {
                                                $ifNull: [
                                                    { $arrayElemAt: [{ $ifNull: ['$userInfo.soundcloud', []] }, 0] },
                                                    {
                                                        $ifNull: [
                                                            { $arrayElemAt: [{ $ifNull: ['$userInfo.facebook', []] }, 0] },
                                                            {
                                                                $ifNull: [
                                                                    { $arrayElemAt: [{ $ifNull: ['$userInfo.youtube', []] }, 0] },
                                                                    { $arrayElemAt: [{ $ifNull: ['$userInfo.press', []] }, 0] },
                                                                ],
                                                            },
                                                        ],
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },

                    socialMedia: {
                        $switch: {
                            branches: [
                                {
                                    case: { $gt: [{ $size: { $ifNull: ['$userInfo.instagram', []] } }, 0] },
                                    then: 'instagram',
                                },
                                {
                                    case: { $gt: [{ $size: { $ifNull: ['$userInfo.tiktok', []] } }, 0] },
                                    then: 'tiktok',
                                },
                                {
                                    case: { $gt: [{ $size: { $ifNull: ['$userInfo.spotify', []] } }, 0] },
                                    then: 'spotify',
                                },
                                {
                                    case: { $gt: [{ $size: { $ifNull: ['$userInfo.soundcloud', []] } }, 0] },
                                    then: 'soundcloud',
                                },
                                {
                                    case: { $gt: [{ $size: { $ifNull: ['$userInfo.facebook', []] } }, 0] },
                                    then: 'facebook',
                                },
                                {
                                    case: { $gt: [{ $size: { $ifNull: ['$userInfo.youtube', []] } }, 0] },
                                    then: 'youtube',
                                },
                                {
                                    case: { $gt: [{ $size: { $ifNull: ['$userInfo.press', []] } }, 0] },
                                    then: 'press',
                                },
                            ],
                            default: null,
                        },
                    },

                    paymentDetails: {
                        $ifNull: [
                            '$paypal',
                            {
                                $ifNull: [
                                    '$ukBankTransfer',
                                    '$internationalBankTransfer',
                                ],
                            },
                        ],
                    },
                },
            },

            {
                $project: {
                    _id: 1,
                    firstName: { $ifNull: ['$userInfo.firstName', null] },
                    lastName: { $ifNull: ['$userInfo.lastName', null] },
                    socialMedia: 1,
                    username: { $ifNull: ['$firstSocialAccount.username', null] },
                    createdAt: 1,
                    amount: 1,
                    paymentMethod: '$selectedPaymentMethod',
                    paymentDetails: 1,
                    status: 1,
                },
            },
        ];

        const totalPipeline: PipelineStage[] = [
            ...(matchStage ? [matchStage] : []),
            {$count: 'total'},
        ];

        const [items, totalResult] = await Promise.all([
            this.influencerInvoiceModel.aggregate<IAdminInfluencerInvoice>(basePipeline),
            this.influencerInvoiceModel.aggregate(totalPipeline),
        ]);

        const total = totalResult[0]?.total ?? 0;

        return {
            items,
            total,
            limit,
        };
    }
}