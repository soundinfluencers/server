import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Offer, OfferSchema } from '../../database/schemas/offer/offer.schema';
import {Influencer, InfluencerSchema} from "../../database/schemas/users/influencer.schema";
import {OfferAccountLink, OfferAccountLinkSchema} from "../../database/schemas/offer/offer-account-link.schema";
import {OfferAccountLinkRepository} from "../../database/repositories/offers/offer-account-link.repository";
import {OfferRepository} from "../../database/repositories/offers/offer.repository";
import {ExchangeRateModule} from "../../integrations/exchange-rate/exchange-rate.module";

@Module({
  imports: [
    ExchangeRateModule,
  ],
  controllers: [OffersController],
  providers: [
    OffersService,
  ],
  exports: [
    OffersService,
  ],
})
export class OffersModule {}