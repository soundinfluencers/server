import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {PaymentHistoryCell} from "../../schemas/histories/payment-history-cell.schema";

// Interface for payment history cell repository
interface IPaymentHistoryCellRepository {
    
}

@Injectable()
export class PaymentHistoryCellRepository extends BaseRepository<PaymentHistoryCell> implements IPaymentHistoryCellRepository {
    
}