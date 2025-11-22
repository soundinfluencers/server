import {Module} from '@nestjs/common';
import {MongooseModule} from "@nestjs/mongoose";
import {Offer, OfferSchema} from "../offers/schemas/offer.schema";
import {Influencer, InfluencerSchema} from "../auth/schemas/influencer.schema";
import {Promos, PromosSchema} from "../promos/schemas/promo.schema";
import {ScrapersService} from "./scrapers.service";
import {ScrapersGateway} from "./scrapers.gateway";
import {ScrapersController} from "./scrapers.controller";

@Module({
    imports: [
        MongooseModule.forFeature([
            {name: Offer.name, schema: OfferSchema},
            {name: Influencer.name, schema: InfluencerSchema},
            {name: Promos.name, schema: PromosSchema},
        ]),
    ],
    exports: [ScrapersService, ScrapersGateway],
    controllers: [ScrapersController],
    providers: [ScrapersService, ScrapersGateway],
})
export class ScrapersModule {
}
