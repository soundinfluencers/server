import { Module } from '@nestjs/common';
import { AdminClientsService } from './services/admin-clients.service';
import { AdminClientsController } from './controllers/admin-clients.controller';
import { AdminCampaignsController } from './controllers/admin-campaigns.controller';
import { AdminCampaignsService } from './services/admin-campaigns.service';
import { AdminActionsHistoryController } from './controllers/admin-actions-history.controller';
import { AdminActionsHistoryService } from './services/admin-actions-history.service';
import { AdminInfluencersService } from './services/admin-influencers.service';
import { AdminInfluencersController } from './controllers/admin-influencers.controller';
import { XlsxImporter } from '../../common/utils/import/xlsx/xlsx-import';
import { CampaignDetailsService } from '../campaigns/services/campaign-details.service';
import { CampaignUpdateService } from '../campaigns/services/campaign-update.service';
import { CampaignAccountsBuilderService } from '../campaigns/services/campaign-accounts-builder.service';
import { ProposalCampaignDetailsService } from '../proposal-system/services/proposal-campaign-details.service';
import { ProposalCampaignUpdateService } from '../proposal-system/services/proposal-campaign-update.service';
import { ProposalAccountsBuilderService } from '../proposal-system/services/proposal-accounts-builder.service';
import { MediaService } from '../media/media.service';
import { MediaStrategyFactory } from '../media/media.factory';
import { DropboxMediaStrategy } from '../media/strategies/dropbox.strategy';
import { DirectMediaStrategy } from '../media/strategies/direct.strategy';
import { GdriveMediaStrategy } from '../media/strategies/gdrive.strategy';
import DropboxService from '../../integrations/dropbox/dropbox';
import GoogleDriveService from '../../integrations/gdrive/gdrive';
import { AdminPaymentsHistoryService } from './services/admin-payments-history.service';
import { AdminPaymentsHistoryController } from './controllers/admin-payments-history.controller';
import { InfluencerActionsHistoryService } from '../influencer-actions-history/influencer-actions-history.service';
import { AdminInvoicesController } from './controllers/admin-invoices.controller';
import { AdminClientInvoicesService } from './services/invoices/admin-client-invoices.service';
import { AdminInfluencerInvoicesService } from './services/invoices/admin-influencer-invoices.service';
import { OffersModule } from '../offers/offers.module';
import { AdminOffersService } from './services/admin-offers.service';
import { AdminOffersController } from './controllers/admin-offers.controller';
import { WhatsappModule } from '../../integrations/whatsapp/whatsapp.module';
import { EmailModule } from '../../integrations/email/email.module';
import { AdminRequestsService } from './services/requests/admin-requests.service';
import { AdminRequestsController } from './controllers/admin-requests.controller';
import {
  NEW_CLIENT_REQUEST_HANDLER,
  NewClientRequestHandler,
} from './services/requests/handlers/new-client-request.handler';
import {
  CAMPAIGN_REQUEST_HANDLER,
  CampaignRequestHandler,
} from './services/requests/handlers/campaign-request.handler';
import {
  BESPOKE_CAMPAIGN_REQUEST_HANDLER,
  BespokeCampaignRequestHandler,
} from './services/requests/handlers/bespoke-campaign-request.handler';
import {
  NEW_INFLUENCER_REQUEST_HANDLER,
  NewInfluencerRequestHandler,
} from './services/requests/handlers/new-influencer-request.handler';
import {
  ADMIN_REQUEST_HANDLERS,
  AdminRequestHandlers,
} from './services/requests/handlers/admin-request-handlers.service';
import {
  CREATE_ADMIN_REQUEST_SERVICE,
  CreateAdminRequestService,
} from './services/requests/create-admin-request.service';
import {
  GET_ADMIN_REQUEST_DETAILS_SERVICE,
  GetAdminRequestDetailsService,
} from './services/requests/get-admin-request-details.service';

@Module({
  imports: [EmailModule],
  controllers: [AdminRequestsController],
  providers: [
    AdminRequestsService,
    InfluencerActionsHistoryService,
    {
      provide: NEW_CLIENT_REQUEST_HANDLER,
      useClass: NewClientRequestHandler,
    },
    {
      provide: CAMPAIGN_REQUEST_HANDLER,
      useClass: CampaignRequestHandler,
    },
    {
      provide: BESPOKE_CAMPAIGN_REQUEST_HANDLER,
      useClass: BespokeCampaignRequestHandler,
    },
    {
      provide: NEW_INFLUENCER_REQUEST_HANDLER,
      useClass: NewInfluencerRequestHandler,
    },
    {
      provide: ADMIN_REQUEST_HANDLERS,
      useClass: AdminRequestHandlers,
    },
    {
      provide: GET_ADMIN_REQUEST_DETAILS_SERVICE,
      useClass: GetAdminRequestDetailsService,
    },
    {
      provide: CREATE_ADMIN_REQUEST_SERVICE,
      useClass: CreateAdminRequestService,
    },
  ],
  exports: [CREATE_ADMIN_REQUEST_SERVICE],
})
export class AdminRequestsModule {}

@Module({
  imports: [OffersModule, WhatsappModule, AdminRequestsModule],
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
    GdriveMediaStrategy,
    DirectMediaStrategy,
    DropboxService,
    GoogleDriveService,
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
