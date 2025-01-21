import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {ProposalSystemController} from "./proposal-system.controller";
import {ProposalSystemService} from "./proposal-system.service";
import {Client, ClientSchema} from "../auth/schemas/client.schema";
import {Influencer, InfluencerSchema} from "../auth/schemas/influencer.schema";
import {ProposalCampaign, ProposalCampaignSchema} from "./schemas/proposal-campaign.schema";

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Client.name, schema: ClientSchema },
            { name: Influencer.name, schema: InfluencerSchema },
            { name: ProposalCampaign.name, schema: ProposalCampaignSchema },
        ]),
    ],
    controllers: [ProposalSystemController],
    providers: [ProposalSystemService],
})
export class ProposalSystemModule {}
