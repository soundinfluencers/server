import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {InfluencerActionsHistory, InfluencerActionsHistorySchema} from "./schemas/influencer-actions-history.schema";
import {Promos, PromosSchema} from "../promos/schemas/promo.schema";
import {PromosCopies, PromosCopiesSchema} from "../admin/schemas/promos-copies.schema";
import {InfluencerActionsHistoryController} from "./influencer-actions-history.controller";
import {InfluencerActionsHistoryService} from "./influencer-actions-history.service";
import {Influencer, InfluencerSchema} from "../../database/schemas/users/influencer.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InfluencerActionsHistory.name, schema: InfluencerActionsHistorySchema },
      { name: Influencer.name, schema: InfluencerSchema },
      { name: Promos.name, schema: PromosSchema },
      { name: PromosCopies.name, schema: PromosCopiesSchema },
    ]),
  ],
  controllers: [InfluencerActionsHistoryController],
  providers: [InfluencerActionsHistoryService],
})
export class InfluencerActionsHistoryModule {}
