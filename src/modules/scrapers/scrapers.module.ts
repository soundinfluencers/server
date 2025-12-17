import {Module} from '@nestjs/common';
import {MongooseModule} from "@nestjs/mongoose";
import {Offer, OfferSchema} from "../offers/schemas/offer.schema";
import {Campaign, CampaignSchema} from "../campaigns/schemas/campaign.schema";
import {ScrapersService} from "./scrapers.service";
import {ScrapersGateway} from "./scrapers.gateway";
import {ScrapersController} from "./scrapers.controller";
import {Influencer, InfluencerSchema} from "../../database/schemas/users/influencer.schema";

@Module({
    imports: [
        MongooseModule.forFeature([
            {name: Offer.name, schema: OfferSchema},
            {name: Influencer.name, schema: InfluencerSchema},
            {name: Campaign.name, schema: CampaignSchema},
        ]),
    ],
    exports: [ScrapersService, ScrapersGateway],
    controllers: [ScrapersController],
    providers: [ScrapersService, ScrapersGateway],
})
export class ScrapersModule {
}
