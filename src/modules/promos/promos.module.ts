import {Module} from '@nestjs/common';
import {PromosService} from './promos.service';
import {PromosController} from './promos.controller';
import {SocialMediaValidationStrategyFactory} from "./strategies/social-media-validation.factory";
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";

@Module({
    controllers: [PromosController],
    providers: [PromosService, SocialMediaValidationStrategyFactory, InfluencerActionsHistoryService],
    exports: [PromosService],
})
export class PromosModule {
}
