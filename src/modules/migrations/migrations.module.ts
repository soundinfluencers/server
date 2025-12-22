import {Module} from "@nestjs/common";
import {MigrationsController} from "./migrations.controller";
import {MigrationsService} from "./migrations.service";
import {ProfileModule} from "../profile/profile.module";
import {PromosModule} from "../promos/promos.module";
import {InfluencerActionsHistoryModule} from "../influencer-actions-history/influencer-actions-history.module";

@Module({
    imports: [
        ProfileModule,
        PromosModule,
        InfluencerActionsHistoryModule,
    ],
    controllers: [MigrationsController],
    providers: [MigrationsService]
})
export class MigrationsModule {}
