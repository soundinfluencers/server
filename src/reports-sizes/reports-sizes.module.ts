import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportSizes, ReportSizesSchema } from './schemas/reports-sizes.schema';
import { Client, ClientSchema } from '../auth/schemas/client.schema';
import { ReportsSizesController } from './reports-sizes.controller';
import { ReportsSizesService } from './reports-sizes.service';
import { Promos, PromosSchema } from '../promos/schemas/promo.schema';
import { ProposalCampaign, ProposalCampaignSchema } from "../proposal-system/schemas/proposal-campaign.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReportSizes.name, schema: ReportSizesSchema },
      { name: Promos.name, schema: PromosSchema },
      { name: Client.name, schema: ClientSchema },
      { name: ProposalCampaign.name, schema: ProposalCampaignSchema },
    ]),
  ],
  controllers: [ReportsSizesController],
  providers: [ReportsSizesService],
})
export class ReportsSizesModule {}
