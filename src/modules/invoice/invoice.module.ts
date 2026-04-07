import {Module} from '@nestjs/common';
import {InvoiceService} from './invoice.service';
import {InvoiceController} from './invoice.controller';
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";
import {EmailService} from "../../integrations/email/email.service";
import {ProfileService} from "../profile/services/profile.service";
import {AppGateway} from "../websocket/app.gateway";
import {AuthService} from "../auth/auth.service";

@Module({
    controllers: [InvoiceController],
    providers: [InvoiceService, InfluencerActionsHistoryService, ProfileService, EmailService, AppGateway, AuthService],
    exports: [InvoiceService]
})
export class InvoiceModule {
}
