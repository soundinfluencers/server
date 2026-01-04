import {Module} from '@nestjs/common';
import {PromosService} from './promos.service';
import {PromosController} from './promos.controller';
import {MongooseModule} from '@nestjs/mongoose';
import {Campaign, CampaignSchema} from '../../database/schemas/campaign/campaign.schema';
import {CompletedCampaign, CompletedCampaignSchema} from '../../database/schemas/campaign/completed-campaign.schema';
import {Client, ClientSchema} from "../../database/schemas/users/client.schema";
import {Influencer, InfluencerSchema} from "../../database/schemas/users/influencer.schema";
import {SocialMediaValidationStrategyFactory} from "./strategies/social-media-validation.factory";
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";

@Module({
    imports: [
        MongooseModule.forFeature([
            {name: Campaign.name, schema: CampaignSchema},
            {name: Client.name, schema: ClientSchema},
            {name: Influencer.name, schema: InfluencerSchema},
            {name: CompletedCampaign.name, schema: CompletedCampaignSchema},
        ]),
    ],
    controllers: [PromosController],
    providers: [PromosService, SocialMediaValidationStrategyFactory, InfluencerActionsHistoryService],
    exports: [PromosService],
})
export class PromosModule {
}
