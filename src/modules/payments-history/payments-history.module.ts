import {Global, Module} from "@nestjs/common";
import {PaymentsHistoryService} from "./payments-history.service";

@Global()
@Module({
    providers: [PaymentsHistoryService],
    exports: [PaymentsHistoryService],
})
export class PaymentsHistoryModule {}