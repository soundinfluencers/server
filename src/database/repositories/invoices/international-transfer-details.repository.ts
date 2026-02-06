import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {InternationalBankTransferDetails} from "../../schemas/invoices/payment-details.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

@Injectable()
export class InternationalBankTransferDetailsRepository extends BaseRepository<InternationalBankTransferDetails> {
    constructor(
        @InjectModel(InternationalBankTransferDetails.name)
        private readonly internationalTransfer: Model<InternationalBankTransferDetails>,
    ) {
        super(internationalTransfer);
    }
}