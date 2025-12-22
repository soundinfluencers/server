import {Module} from '@nestjs/common';
import {MongooseModule} from '@nestjs/mongoose';
import {
    InfluencerActionsHistory,
    InfluencerActionsHistorySchema
} from "../../database/schemas/histories/influencer-actions-history.schema";
import {Campaign, CampaignSchema} from "../../database/schemas/campaign/campaign.schema";
import {CompletedCampaignSchema, CompletedCampaign} from "../../database/schemas/campaign/completed-campaign.schema";
import {InfluencerActionsHistoryController} from "./influencer-actions-history.controller";
import {InfluencerActionsHistoryService} from "./influencer-actions-history.service";
import {Influencer, InfluencerSchema} from "../../database/schemas/users/influencer.schema";

@Module({
    imports: [
        MongooseModule.forFeature([
            {name: InfluencerActionsHistory.name, schema: InfluencerActionsHistorySchema},
            {name: Influencer.name, schema: InfluencerSchema},
            {name: Campaign.name, schema: CampaignSchema},
            {name: CompletedCampaign.name, schema: CompletedCampaignSchema},
        ]),
    ],
    controllers: [InfluencerActionsHistoryController],
    providers: [InfluencerActionsHistoryService],
    exports: [InfluencerActionsHistoryService],
})
export class InfluencerActionsHistoryModule {
}
