import {ProfileService} from "../profile/profile.service";
import {PromosService} from "../promos/promos.service";
import {MigrateAccountDto} from "./dto/migrate-account.dto";
import {Connection} from "mongoose";
import {Injectable} from "@nestjs/common";
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";
import {InjectConnection} from "@nestjs/mongoose";

@Injectable()
export class MigrationsService {
    constructor(
        @InjectConnection()
        private readonly connection: Connection,
        private readonly profileService: ProfileService,
        private readonly promosService: PromosService,
        private readonly influencersHistoryService: InfluencerActionsHistoryService,
    ) {}

    // Migrating social account to new owner (with history and updating campaigns)
    async migrateSocialAccountOrchestrator(data: MigrateAccountDto) {
        const session = await this.connection.startSession();
        session.startTransaction();

        try {
            // move social account to new owner
            const context = await this.profileService.moveSocialAccount(data, session);

            // move social account's campaigns history to new owner's history
            await this.influencersHistoryService.moveSocialAccountHistory(context, session);

            // replace all old influencerId with new owner's id in ongoing promos
            await this.promosService.replaceInfluencerIdInOngoingPromos(context, session);

            await session.commitTransaction();
        } catch (e) {
            await session.abortTransaction();
            throw e;
        } finally {
            session.endSession();
        }
    }
}