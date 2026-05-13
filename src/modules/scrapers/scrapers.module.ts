import {Module} from '@nestjs/common';
import {MongooseModule} from "@nestjs/mongoose";
import {Offer, OfferSchema} from "../../database/schemas/offer/offer.schema";
import {OfferAccountLink, OfferAccountLinkSchema} from "../../database/schemas/offer/offer-account-link.schema";
import {Campaign, CampaignSchema} from "../../database/schemas/campaign/campaign.schema";
import {ScrapersService} from "./scrapers.service";
import {ScrapersController} from "./scrapers.controller";
import {Influencer, InfluencerSchema} from "../../database/schemas/users/influencer.schema";
import {WebsocketModule} from "../websocket/websocket.module";

@Module({
    imports: [
        WebsocketModule,
        MongooseModule.forFeature([
            {name: Offer.name, schema: OfferSchema},
            {name: OfferAccountLink.name, schema: OfferAccountLinkSchema},
            {name: Influencer.name, schema: InfluencerSchema},
            {name: Campaign.name, schema: CampaignSchema},
        ]),
    ],
    exports: [ScrapersService],
    controllers: [ScrapersController],
    providers: [ScrapersService],
})
export class ScrapersModule {
}
