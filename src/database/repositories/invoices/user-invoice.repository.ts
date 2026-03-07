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

// Interface for UserInvoiceRepository
export interface IUserInvoiceRepository {
    // Creates new client invoice (after creating new campaign). support client session
    createClientInvoice(payload: CreateCampaignInvoiceDto, session?: ClientSession): Promise<ClientInvoiceDocument>;

    //Creates new influencer invoice (with linked promos). support influencer session
    createInfluencerInvoice(payload: CreateInvoiceDto, session?: ClientSession): Promise<InfluencerInvoiceDocument>;
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

    async findClientInvoices(): Promise<ClientInvoiceDocument[]> {
        return this.clientInvoiceModel.find().exec();
    }

    async findInfluencerInvoices(): Promise<InfluencerInvoiceDocument[]> {
        return this.influencerInvoiceModel.find().exec();
    }
}