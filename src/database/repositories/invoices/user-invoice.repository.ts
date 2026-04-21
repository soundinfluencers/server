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

    // Returns one invoice that was found by campaignId
    findInvoiceByCampaignId(campaignId: string): Promise<UserInvoiceDocument | null>;

    // Return paginated list of IAdminClientInvoice or IAdminInfluencerInvoice objects
    findPaginated(
        query: PaginationQueryDto,
        role: Role.client | Role.influencer,
    ): Promise<{
        items: IAdminClientInvoice[] | IAdminInfluencerInvoice[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>

    // Search for invoices by query and get IAdminClientInvoice or IAdminInfluencerInvoice objects
    findBySearch(
        query: SearchQueryDto,
        role: Role.client | Role.influencer,
    ): Promise<{
        items: IAdminClientInvoice[] | IAdminInfluencerInvoice[];
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

    async findPaginated(
        query: PaginationQueryDto,
        role: Role.client | Role.influencer,
    ): Promise<{
        items: IAdminClientInvoice[] | IAdminInfluencerInvoice[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;

        const model = role === Role.client ? this.clientInvoiceModel : this.influencerInvoiceModel;

        const [items, totalResult] = await Promise.all([
            model.aggregate<IAdminClientInvoice | IAdminInfluencerInvoice>([
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
            model.aggregate([{$count: 'total'}]),
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
        role: Role.client | Role.influencer,
    ): Promise<{
        items: IAdminClientInvoice[] | IAdminInfluencerInvoice[];
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

        const model = role === Role.client ? this.clientInvoiceModel : this.influencerInvoiceModel;

        const [items, totalResult] = await Promise.all([
            model.aggregate<IAdminClientInvoice | IAdminInfluencerInvoice>(basePipeline),
            model.aggregate(totalPipeline),
        ]);

        const total = totalResult[0]?.total ?? 0;

        return {
            items,
            total,
            limit,
        };
    }
}