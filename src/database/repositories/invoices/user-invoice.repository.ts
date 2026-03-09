import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {ClientSession, Model} from 'mongoose';
import {
    UserInvoice,
    UserInvoiceDocument,
    ClientInvoiceDocument,
    InfluencerInvoiceDocument,
    InfluencerInvoice,
} from '../../schemas/invoices/user-invoice.schema';
import { Role } from '../../../common/types/user.types';
import {BaseRepository} from "../base.repository";
import {CreateCampaignInvoiceDto, CreateInvoiceDto} from "../../../modules/invoice/dto/create-invoice.dto";
import {
    CreateClientInvoiceDbShape,
    mapDtoToClientInvoice, mapDtoToInfluencerInvoice,
} from "../../../common/mappers/invoice.mapper";
import {ObjId} from "../../../common/types/base.types";
import {UpdateClientInvoiceDto} from "../../../modules/invoice/dto/update-invoice.dto";

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
            { session }
        );

        return doc;
    }

    async createInfluencerInvoice(
        payload: CreateInvoiceDto,
        session?: ClientSession
    ): Promise<InfluencerInvoiceDocument> {
        const [doc] = await this.influencerInvoiceModel.create(
            [mapDtoToInfluencerInvoice(payload)],
            { session }
        )

        return doc;
    }

    async findInvoiceById(
        invoiceId: string
    ): Promise<ClientInvoiceDocument | InfluencerInvoiceDocument | null> {
        const invoice = await this.userInvoiceModel.findById(new ObjId(invoiceId)).exec() as unknown as
            ClientInvoiceDocument | InfluencerInvoiceDocument | null;
        return invoice;
    }

    async updateClientInvoiceById(
        invoiceId: string,
        payload: UpdateClientInvoiceDto
    ): Promise<ClientInvoiceDocument | null> {
        return this.clientInvoiceModel.findByIdAndUpdate(
            new ObjId(invoiceId),
            { $set: payload },
            { new: true, runValidators: true }
        ).exec();
    }
}