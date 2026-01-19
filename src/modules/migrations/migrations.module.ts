import {Module} from "@nestjs/common";
import {MigrationsController} from "./migrations.controller";
import {MigrationsService} from "./migrations.service";
import {ProfileModule} from "../profile/profile.module";
import {PromosModule} from "../promos/promos.module";
import {InfluencerActionsHistoryModule} from "../influencer-actions-history/influencer-actions-history.module";
import {CompletedCampaign, CompletedCampaignSchema} from "../../database/schemas/campaign/completed-campaign.schema";
import {Influencer, InfluencerSchema} from "../../database/schemas/users/influencer.schema";
import {MongooseModule} from "@nestjs/mongoose";

@Module({
    imports: [
        ProfileModule,
        PromosModule,
        InfluencerActionsHistoryModule,
        MongooseModule.forFeature([
            {name: Influencer.name, schema: InfluencerSchema},
            {name: CompletedCampaign.name, schema: CompletedCampaignSchema},
        ])
    ],
    controllers: [MigrationsController],
    providers: [MigrationsService]
})
export class MigrationsModule {
}
