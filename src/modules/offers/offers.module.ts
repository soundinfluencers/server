import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Influencer, InfluencerSchema } from '../auth/schemas/influencer.schema';
import { Offer, OfferSchema } from './schemas/offer.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Offer.name, schema: OfferSchema },
      { name: Influencer.name, schema: InfluencerSchema },
    ]),
  ],
  controllers: [OffersController],
  providers: [OffersService],
})
export class OffersModule {}
