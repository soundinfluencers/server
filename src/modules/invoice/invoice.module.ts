import {Module} from '@nestjs/common';
import {InvoiceService} from './invoice.service';
import {InvoiceController} from './invoice.controller';
import {InfluencerActionsHistoryModule} from "../influencer-actions-history/influencer-actions-history.module";
import {AuthModule} from "../auth/auth.module";
import {ProfileModule} from "../profile/profile.module";
import {EmailModule} from "../../integrations/email/email.module";

@Module({
    imports: [
        InfluencerActionsHistoryModule,
        ProfileModule,
        EmailModule,
        AuthModule,
    ],
    controllers: [InvoiceController],
    providers: [
        InvoiceService,
    ],
    exports: [
        InvoiceService,
    ],
})
export class InvoiceModule {
}
