import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MultiPromoController } from './multipromo.controller';
import { MultiPromoService } from './multipromo.service';
import {Client, ClientSchema} from "../../database/schemas/users/client.schema";
import {Influencer, InfluencerSchema} from "../../database/schemas/users/influencer.schema";

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
