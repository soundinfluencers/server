import {Module} from '@nestjs/common';
import {InfluencerActionsHistoryController} from "./influencer-actions-history.controller";
import {InfluencerActionsHistoryService} from "./influencer-actions-history.service";

@Module({
    controllers: [InfluencerActionsHistoryController],
    providers: [InfluencerActionsHistoryService],
    exports: [InfluencerActionsHistoryService],
})
export class InfluencerActionsHistoryModule {
}
