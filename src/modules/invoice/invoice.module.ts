import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";
import {EmailService} from "../email/email.service";
import {ProfileService} from "../profile/profile.service";
import {AppGateway} from "../websocket/app.gateway";

@Module({
  controllers: [InvoiceController],
  providers: [InvoiceService, InfluencerActionsHistoryService, ProfileService, EmailService, AppGateway],
})
export class InvoiceModule {}
