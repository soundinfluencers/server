import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Client, ClientSchema } from '../auth/schemas/client.schema';
import { Influencer, InfluencerSchema } from '../auth/schemas/influencer.schema';
import { MultiPromoController } from './multipromo.controller';
import { MultiPromoService } from './multipromo.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: Influencer.name, schema: InfluencerSchema },
    ]),
  ],
  controllers: [MultiPromoController],
  providers: [MultiPromoService],
})
export class MultiPromoModule {}
