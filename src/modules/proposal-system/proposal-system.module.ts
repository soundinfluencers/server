import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProposalSystemController } from './proposal-system.controller';
import { ProposalSystemService } from './proposal-system.service';
import { ProposalCampaign, ProposalCampaignSchema } from './schemas/proposal-campaign.schema';
import { Promos, PromosSchema } from "../promos/schemas/promo.schema";
import {PromosModule} from "../promos/promos.module";
import {Client, ClientSchema} from "../../database/schemas/users/client.schema";
import {Influencer, InfluencerSchema} from "../../database/schemas/users/influencer.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: Influencer.name, schema: InfluencerSchema },
      { name: ProposalCampaign.name, schema: ProposalCampaignSchema },
      { name: Promos.name, schema: PromosSchema },
    ]),
      PromosModule
  ],
  controllers: [ProposalSystemController],
  providers: [ProposalSystemService],
})
export class ProposalSystemModule {}
