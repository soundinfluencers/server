import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";
import {EmailService} from "../email/email.service";

@Module({
  controllers: [InvoiceController],
  providers: [InvoiceService, InfluencerActionsHistoryService, EmailService],
})
export class InvoiceModule {}
