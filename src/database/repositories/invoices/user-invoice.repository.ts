import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {UserInvoice} from "../../schemas/invoices/user-invoice.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

@Injectable()
export class UserInvoiceRepository extends BaseRepository<UserInvoice> {
    constructor(
        @InjectModel(UserInvoice.name)
        private readonly invoiceModel: Model<UserInvoice>
    ) {
        super(invoiceModel);
    }

    
}