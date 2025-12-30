import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { Invoices } from '../invoice/schemas/invoices.schema';
import { Payment } from '../payment/schemas/payment.entity';
import {CompletedCampaignSchema, CompletedCampaign} from '../../database/schemas/campaign/completed-campaign.schema';
import { WebsocketModule } from '../websocket/app.gateway';
import {Client, ClientSchema} from "../../database/schemas/users/client.schema";
import {Influencer, InfluencerSchema} from "../../database/schemas/users/influencer.schema";
import {Campaign, CampaignSchema} from "../../database/schemas/campaign/campaign.schema";
import {ProposalCampaign, ProposalCampaignSchema} from "../../database/schemas/campaign/proposal-campaign.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: Client.name, schema: ClientSchema },
      { name: Influencer.name, schema: InfluencerSchema },
      { name: Invoices.name, schema: Invoices },
      { name: Payment.name, schema: Payment },
      { name: CompletedCampaign.name, schema: CompletedCampaignSchema },
      { name: ProposalCampaign.name, schema: ProposalCampaignSchema },
    ]),
    WebsocketModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
