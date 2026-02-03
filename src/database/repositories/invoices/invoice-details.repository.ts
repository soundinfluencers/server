import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";
import {InvoiceDetails} from "../../schemas/invoices/invoice-details.schema";

@Injectable()
export class InvoiceDetailsRepository extends BaseRepository<InvoiceDetails> {
    constructor(
        @InjectModel(InvoiceDetails.name)
        private readonly invoiceDetailsModel: Model<InvoiceDetails>
    ) {
        super(invoiceDetailsModel);
    }


}