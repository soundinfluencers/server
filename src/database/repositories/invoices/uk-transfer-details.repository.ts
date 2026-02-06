import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {UKBankTransferDetails} from "../../schemas/invoices/payment-details.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

@Injectable()
export class UkBankTransferDetailsRepository extends BaseRepository<UKBankTransferDetails> {
    constructor(
        @InjectModel(UKBankTransferDetails.name)
        private readonly ukTransfer: Model<UKBankTransferDetails>,
    ) {
        super(ukTransfer);
    }
}