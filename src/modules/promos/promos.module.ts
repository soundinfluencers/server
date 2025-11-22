import { Module } from '@nestjs/common';
import { PromosService } from './promos.service';
import { PromosController } from './promos.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Promos, PromosSchema } from './schemas/promo.schema';
import { PromosCopies, PromosCopiesSchema } from '../admin/schemas/promos-copies.schema';
import {
  ProposalCampaign,
  ProposalCampaignSchema,
} from '../proposal-system/schemas/proposal-campaign.schema';
import {Client, ClientSchema} from "../auth/schemas/client.schema";
import {Influencer, InfluencerSchema} from "../auth/schemas/influencer.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Promos.name, schema: PromosSchema },
      { name: Client.name, schema: ClientSchema },
      { name: Influencer.name, schema: InfluencerSchema },
      { name: PromosCopies.name, schema: PromosCopiesSchema },
      { name: ProposalCampaign.name, schema: ProposalCampaignSchema },
    ]),
  ],
  controllers: [PromosController],
  providers: [PromosService],
  exports: [PromosService],
})
export class PromosModule {}
