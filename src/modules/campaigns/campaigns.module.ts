import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './services/campaigns.service';
import { InfluencerActionsHistoryService } from '../influencer-actions-history/influencer-actions-history.service';
import { MediaModule } from '../media/media.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { CampaignDetailsService } from './services/campaign-details.service';
import { CampaignUpdateService } from './services/campaign-update.service';
import { CampaignAccountsBuilderService } from './services/campaign-accounts-builder.service';
import { AdminRequestsModule } from '../admin/admin.module';

@Module({
  imports: [MediaModule, InvoiceModule, AdminRequestsModule],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    InfluencerActionsHistoryService,
    CampaignDetailsService,
    CampaignUpdateService,
    CampaignAccountsBuilderService,
  ],
  exports: [
    CampaignsService,
    CampaignDetailsService,
    CampaignUpdateService,
    CampaignAccountsBuilderService,
  ],
})
export class CampaignsModule {}
