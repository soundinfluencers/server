import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {InfluencerInvoice} from "../../schemas/invoices/influencer-invoice.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

@Injectable()
export class InfluencerInvoiceRepository extends BaseRepository<InfluencerInvoice> {
    constructor(
        @InjectModel(InfluencerInvoice.name)
        private readonly invoiceModel: Model<InfluencerInvoice>
    ) {
        super(invoiceModel);
    }

    
}