import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportSizes, ReportSizesSchema } from '../../database/schemas/report-size/reports-sizes.schema';
import { ReportsSizesController } from './reports-sizes.controller';
import { ReportsSizesService } from './reports-sizes.service';
import {Campaign, CampaignSchema} from '../../database/schemas/campaign/campaign.schema';
import {Client, ClientSchema} from "../../database/schemas/users/client.schema";
import {ProposalCampaign, ProposalCampaignSchema} from "../../database/schemas/campaign/proposal-campaign.schema";

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
