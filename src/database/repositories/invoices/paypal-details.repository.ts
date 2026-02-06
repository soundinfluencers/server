import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {PayPalDetails} from "../../schemas/invoices/payment-details.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

@Injectable()
export class PaypalDetailsRepository extends BaseRepository<PayPalDetails> {
    constructor(
        @InjectModel(PayPalDetails.name)
        private readonly paypalDetails: Model<PayPalDetails>,
    ) {
        super(paypalDetails);
    }
}