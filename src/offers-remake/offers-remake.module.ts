import { Module } from '@nestjs/common';
import { OffersRemakeService } from './offers-remake.service';
import { OffersRemakeController } from './offers-remake.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { OfferRemake, OfferRemakeSchema } from './schemas/offer-remake.schema';
import { Influencer, InfluencerSchema } from '../auth/schemas/influencer.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OfferRemake.name, schema: OfferRemakeSchema },
      { name: Influencer.name, schema: InfluencerSchema },
    ]),
  ],
  controllers: [OffersRemakeController],
  providers: [OffersRemakeService],
})
export class OffersRemakeModule {}
