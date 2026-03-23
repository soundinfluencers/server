import { Module } from '@nestjs/common';
import { AdminClientsService } from './services/admin-clients.service';
import { AdminClientsController } from './controllers/admin-clients.controller';
import {AdminCampaignsController} from "./controllers/admin-campaigns.controller";
import {AdminCampaignsService} from "./services/admin-campaigns.service";
import {AdminActionsHistoryController} from "./controllers/admin-actions-history.controller";
import {AdminActionsHistoryService} from "./services/admin-actions-history.service";
import {AdminInfluencersService} from "./services/admin-influencers.service";
import {AdminInfluencersController} from "./controllers/admin-influencers.controller";

@Module({
  controllers: [
      AdminClientsController,
      AdminCampaignsController,
      AdminActionsHistoryController,
      AdminInfluencersController,
  ],
  providers: [
      AdminClientsService,
      AdminCampaignsService,
      AdminActionsHistoryService,
      AdminInfluencersService,
  ],
})
export class AdminModule {}
