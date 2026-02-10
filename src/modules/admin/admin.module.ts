import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment } from '../payment/schemas/payment.entity';
import {CompletedCampaignSchema, CompletedCampaign} from '../../database/schemas/campaign/completed-campaign.schema';
import { WebsocketModule } from '../websocket/app.gateway';
import {Client, ClientSchema} from "../../database/schemas/users/client.schema";
import {Influencer, InfluencerSchema} from "../../database/schemas/users/influencer.schema";
import {Campaign, CampaignSchema} from "../../database/schemas/campaign/campaign.schema";
import {ProposalCampaign, ProposalCampaignSchema} from "../../database/schemas/campaign/proposal-campaign.schema";
import {
    UserInvoice, UserInvoiceSchema
} from "../../database/schemas/invoices/user-invoice.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: Client.name, schema: ClientSchema },
      { name: Influencer.name, schema: InfluencerSchema },
      { name: UserInvoice.name, schema: UserInvoiceSchema },
      { name: Payment.name, schema: Payment },
      { name: CompletedCampaign.name, schema: CompletedCampaignSchema },
      { name: ProposalCampaign.name, schema: ProposalCampaignSchema },
    ]),
    WebsocketModule,
  ],
  // controllers: [AdminController],
  // providers: [AdminService],
})
export class AdminModule {}
