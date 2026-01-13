import {Global, Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";
import {Influencer, InfluencerSchema} from "./schemas/users/influencer.schema";
import {Client, ClientSchema} from "./schemas/users/client.schema";
import {InfluencerRepository} from "./repositories/users/influencer.repository";
import {ClientRepository} from "./repositories/users/client.repository";
import {VerifyInfluencer, VerifyInfluencerSchema} from "./schemas/verify-users/verifyInfluencer.schema";
import {VerifyClient, VerifyClientSchema} from "./schemas/verify-users/verifyClient.schema";
import {VerifyClientRepository} from "./repositories/verify-users/verify-client.repository";
import {VerifyInfluencerRepository} from "./repositories/verify-users/verify-influencer.repository";
import {
    InfluencerActionsHistory,
    InfluencerActionsHistorySchema
} from "./schemas/histories/influencer-actions-history.schema";
import {InfluencerHistoryRepository} from "./repositories/histories/influencer-history.repository";
import {Campaign, CampaignSchema} from "./schemas/campaign/campaign.schema";
import {CompletedCampaign, CompletedCampaignSchema} from "./schemas/campaign/completed-campaign.schema";
import {CampaignRepository} from "./repositories/campaigns/campaign.repository";
import {CompletedCampaignRepository} from "./repositories/campaigns/completed-campaign.repository";
import {ProposalCampaign, ProposalCampaignSchema} from "./schemas/campaign/proposal-campaign.schema";
import {ProposalCampaignRepository} from "./repositories/campaigns/proposal-campaign.repository";
import {Admin, AdminSchema} from "./schemas/users/admin.schema";
import {AdminRepository} from "./repositories/users/admin.repository";
import {InfluencerInvoice, InfluencerInvoiceSchema} from "./schemas/invoices/influencer-invoice.schema";
import {InfluencerInvoiceRepository} from "./repositories/invoices/influencer-invoice.repository";
import {ReportSizes, ReportSizesSchema} from "./schemas/report-size/reports-sizes.schema";
import {ReportSizeRepository} from "./repositories/report-size/report-size.repository";
import {DraftCampaign, DraftCampaignSchema} from "./schemas/campaign/draft-campaign.schema";
import {DraftCampaignRepository} from "./repositories/campaigns/draft-campaign.repository";

@Global()
@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Influencer.name, schema: InfluencerSchema },
            { name: Client.name, schema: ClientSchema },
            { name: Admin.name, schema: AdminSchema },
            { name: VerifyInfluencer.name, schema: VerifyInfluencerSchema },
            { name: VerifyClient.name, schema: VerifyClientSchema },
            { name: InfluencerActionsHistory.name, schema: InfluencerActionsHistorySchema },
            { name: Campaign.name, schema: CampaignSchema },
            { name: DraftCampaign.name, schema: DraftCampaignSchema },
            { name: CompletedCampaign.name, schema: CompletedCampaignSchema },
            { name: ProposalCampaign.name, schema: ProposalCampaignSchema },
            { name: InfluencerInvoice.name, schema: InfluencerInvoiceSchema },
            { name: ReportSizes.name, schema: ReportSizesSchema },
        ]),
    ],
    providers: [
        ClientRepository,
        InfluencerRepository,
        AdminRepository,
        VerifyClientRepository,
        VerifyInfluencerRepository,
        InfluencerHistoryRepository,
        CampaignRepository,
        DraftCampaignRepository,
        CompletedCampaignRepository,
        ProposalCampaignRepository,
        InfluencerInvoiceRepository,
        ReportSizeRepository,
    ],
    exports: [
        ClientRepository,
        InfluencerRepository,
        AdminRepository,
        VerifyClientRepository,
        VerifyInfluencerRepository,
        InfluencerHistoryRepository,
        CampaignRepository,
        DraftCampaignRepository,
        CompletedCampaignRepository,
        ProposalCampaignRepository,
        InfluencerInvoiceRepository,
        ReportSizeRepository,
    ],
})
export class DatabaseModule {}