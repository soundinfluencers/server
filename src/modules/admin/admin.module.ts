import {Module} from '@nestjs/common';
import { AdminClientsService } from './services/admin-clients.service';
import { AdminClientsController } from './controllers/admin-clients.controller';
import {AdminCampaignsController} from "./controllers/admin-campaigns.controller";
import {AdminCampaignsService} from "./services/admin-campaigns.service";
import {AdminActionsHistoryController} from "./controllers/admin-actions-history.controller";
import {AdminActionsHistoryService} from "./services/admin-actions-history.service";
import {AdminInfluencersService} from "./services/admin-influencers.service";
import {AdminInfluencersController} from "./controllers/admin-influencers.controller";
import {XlsxImporter} from "../../common/utils/import/xlsx/xlsx-import";
import {CampaignDetailsService} from "../campaigns/services/campaign-details.service";
import {CampaignUpdateService} from "../campaigns/services/campaign-update.service";
import {CampaignAccountsBuilderService} from "../campaigns/services/campaign-accounts-builder.service";
import {ProposalCampaignDetailsService} from "../proposal-system/services/proposal-campaign-details.service";
import {ProposalCampaignUpdateService} from "../proposal-system/services/proposal-campaign-update.service";
import {ProposalAccountsBuilderService} from "../proposal-system/services/proposal-accounts-builder.service";
import {MediaService} from "../media/media.service";
import {MediaStrategyFactory} from "../media/media.factory";
import {DropboxMediaStrategy} from "../media/strategies/dropbox.strategy";
import {DirectMediaStrategy} from "../media/strategies/direct.strategy";
import DropboxService from "../../integrations/dropbox/dropbox";
import {AdminPaymentsHistoryService} from "./services/admin-payments-history.service";
import {AdminPaymentsHistoryController} from "./controllers/admin-payments-history.controller";
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";
import {AdminInvoicesController} from "./controllers/admin-invoices.controller";
import {AdminClientInvoicesService} from "./services/invoices/admin-client-invoices.service";
import {AdminInfluencerInvoicesService} from "./services/invoices/admin-influencer-invoices.service";
import {OffersModule} from "../offers/offers.module";
import {AdminOffersService} from "./services/admin-offers.service";
import {AdminOffersController} from "./controllers/admin-offers.controller";

@Module({
  imports: [
      OffersModule,
  ],
  controllers: [
      AdminClientsController,
      AdminCampaignsController,
      AdminActionsHistoryController,
      AdminInfluencersController,
      AdminPaymentsHistoryController,
      AdminInvoicesController,
      AdminOffersController,
  ],
  providers: [
      AdminClientsService,
      AdminCampaignsService,
      AdminActionsHistoryService,
      AdminInfluencersService,
      XlsxImporter,
      MediaService,
      MediaStrategyFactory,
      DropboxMediaStrategy,
      DirectMediaStrategy,
      DropboxService,
      CampaignDetailsService,
      CampaignUpdateService,
      CampaignAccountsBuilderService,
      ProposalCampaignDetailsService,
      ProposalCampaignUpdateService,
      ProposalAccountsBuilderService,
      AdminPaymentsHistoryService,
      InfluencerActionsHistoryService,
      AdminClientInvoicesService,
      AdminInfluencerInvoicesService,
      AdminOffersService,
  ],
})
export class AdminModule {}
