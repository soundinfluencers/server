import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportSizes, ReportSizesSchema } from './schemas/reports-sizes.schema';
import { ReportsSizesController } from './reports-sizes.controller';
import { ReportsSizesService } from './reports-sizes.service';
import {Campaign, CampaignSchema} from '../campaigns/schemas/campaign.schema';
import { ProposalCampaign, ProposalCampaignSchema } from "../proposal-system/schemas/proposal-campaign.schema";
import {Client, ClientSchema} from "../../database/schemas/users/client.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReportSizes.name, schema: ReportSizesSchema },
      { name: Campaign.name, schema: CampaignSchema },
      { name: Client.name, schema: ClientSchema },
      { name: ProposalCampaign.name, schema: ProposalCampaignSchema },
    ]),
  ],
  controllers: [ReportsSizesController],
  providers: [ReportsSizesService],
})
export class ReportsSizesModule {}
