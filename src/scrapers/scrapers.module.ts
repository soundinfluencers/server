import {Module} from '@nestjs/common';
import {ScrapersController} from './scrapers.controller';
import {ScrapersService} from './scrapers.service';
import {Offer, OfferSchema} from '../offers/schemas/offer.schema';
import {Influencer, InfluencerSchema} from '../auth/schemas/influencer.schema';
import {MongooseModule} from '@nestjs/mongoose';
import {Promos, PromosSchema} from '../promos/schemas/promo.schema';
import {WebsocketModule} from "../websocket/app.gateway";
import {ScrapersGateway} from "./scrapers.gateway";

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
