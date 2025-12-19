import {ProfileService} from "../profile/profile.service";
import {PromosService} from "../promos/promos.service";
import {MigrateAccountDto} from "./dto/migrate-account.dto";
import mongoose from "mongoose";
import {Injectable} from "@nestjs/common";
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";

@Injectable()
export class MigrationsService {
    constructor(
        private readonly profileService: ProfileService,
        private readonly promosService: PromosService,
        private readonly influencersHistoryService: InfluencerActionsHistoryService,
    ) {}

    // Migrating social account to new owner (with history and updating campaigns)
    async migrateSocialAccountOrchestrator(data: MigrateAccountDto) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // move social account to new owner
            const context = await this.profileService.moveSocialAccount(data, session);

            // move social account's campaigns history to new owner's history
            await this.influencersHistoryService.moveSocialAccountHistory(context, session);

            await this.promosService.replaceInfluencerIdInOngoingPromos(context, session);
            // await this.promosService.updateCompletedCampaigns(context, session);

            await session.commitTransaction();
        } catch (e) {
            await session.abortTransaction();
            throw e;
        } finally {
            session.endSession();
        }
    }
}
