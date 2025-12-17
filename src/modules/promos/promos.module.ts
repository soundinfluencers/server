import {Module} from '@nestjs/common';
import {PromosService} from './promos.service';
import {PromosController} from './promos.controller';
import {MongooseModule} from '@nestjs/mongoose';
import {Campaign, CampaignSchema} from '../campaigns/schemas/campaign.schema';
import {CompletedCampaign, CompletedCampaignSchema} from '../campaigns/schemas/completed-campaign.schema';
import {Client, ClientSchema} from "../../database/schemas/users/client.schema";
import {Influencer, InfluencerSchema} from "../../database/schemas/users/influencer.schema";

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
    providers: [PromosService],
    exports: [PromosService],
})
export class PromosModule {
}
