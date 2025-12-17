import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProposalSystemController } from './proposal-system.controller';
import { ProposalSystemService } from './proposal-system.service';
import { ProposalCampaign, ProposalCampaignSchema } from './schemas/proposal-campaign.schema';
import {Campaign, CampaignSchema} from "../campaigns/schemas/campaign.schema";
import {Client, ClientSchema} from "../../database/schemas/users/client.schema";
import {Influencer, InfluencerSchema} from "../../database/schemas/users/influencer.schema";
import {CampaignsModule} from "../campaigns/campaigns.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: Influencer.name, schema: InfluencerSchema },
      { name: ProposalCampaign.name, schema: ProposalCampaignSchema },
      { name: Campaign.name, schema: CampaignSchema },
    ]),
      CampaignsModule
  ],
  controllers: [ProposalSystemController],
  providers: [ProposalSystemService],
})
export class ProposalSystemModule {}
