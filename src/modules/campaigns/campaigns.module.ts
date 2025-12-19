import {Module} from "@nestjs/common";
import {CampaignsController} from "./campaigns.controller";
import {CampaignsService} from "./campaigns.service";
import {MongooseModule} from "@nestjs/mongoose";
import {Client, ClientSchema} from "../../database/schemas/users/client.schema";
import {Influencer, InfluencerSchema} from "../../database/schemas/users/influencer.schema";
import {CompletedCampaignSchema, CompletedCampaign} from "../../database/schemas/campaign/completed-campaign.schema";
import {ProposalCampaign, ProposalCampaignSchema} from "../proposal-system/schemas/proposal-campaign.schema";
import {Campaign, CampaignSchema} from "../../database/schemas/campaign/campaign.schema";

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Campaign.name, schema: CampaignSchema },
            { name: Client.name, schema: ClientSchema },
            { name: Influencer.name, schema: InfluencerSchema },
            { name: CompletedCampaign.name, schema: CompletedCampaignSchema },
            { name: ProposalCampaign.name, schema: ProposalCampaignSchema },
        ]),
    ],
    controllers: [CampaignsController],
    providers: [CampaignsService],
    exports: [CampaignsService],
})
export class CampaignsModule {}