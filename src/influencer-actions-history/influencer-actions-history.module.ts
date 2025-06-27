import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  InfluencerActionsHistory,
  InfluencerActionsHistorySchema,
} from './schemas/influencer-actions-history.schema';
import { InfluencerActionsHistoryService } from './influencer-actions-history.service';
import { InfluencerActionsHistoryController } from './influencer-actions-history.controller';
import { Influencer, InfluencerSchema } from '../auth/schemas/influencer.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InfluencerActionsHistory.name, schema: InfluencerActionsHistorySchema },
      { name: Influencer.name, schema: InfluencerSchema },
    ]),
  ],
  controllers: [InfluencerActionsHistoryController],
  providers: [InfluencerActionsHistoryService],
})
export class InfluencerActionsHistoryModule {}
