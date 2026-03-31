import {Module} from "@nestjs/common";
import {CampaignsController} from "./campaigns.controller";
import {CampaignsService} from "./campaigns.service";
import {MongooseModule} from "@nestjs/mongoose";
import {Client, ClientSchema} from "../../database/schemas/users/client.schema";
import {Influencer, InfluencerSchema} from "../../database/schemas/users/influencer.schema";
import {CompletedCampaignSchema, CompletedCampaign} from "../../database/schemas/campaign/completed-campaign.schema";
import {Campaign, CampaignSchema} from "../../database/schemas/campaign/campaign.schema";
import {ProposalCampaign, ProposalCampaignSchema} from "../../database/schemas/campaign/proposal-campaign.schema";
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";
import {EmailService} from "../../integrations/email/email.service";
import {MediaModule} from "../media/media.module";
import {InvoiceService} from "../invoice/invoice.service";
import {InvoiceModule} from "../invoice/invoice.module";
import {CampaignDetailsOrchestrator} from "./orchestrators/campaign-details.orchestrator";

@Module({
    imports: [MediaModule, InvoiceModule],
    controllers: [CampaignsController],
    providers: [CampaignsService, InfluencerActionsHistoryService, CampaignDetailsOrchestrator],
    exports: [CampaignsService, CampaignDetailsOrchestrator],
})
export class CampaignsModule {}