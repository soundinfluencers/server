import {NestFactory} from '@nestjs/core';
import {getConnectionToken} from '@nestjs/mongoose';
import {Connection} from 'mongoose';
import {AppModule} from '../src/modules/app/app.module';
import {ProfileService} from '../src/modules/profile/services/profile.service';
import {PromosService} from '../src/modules/promos/promos.service';
import {InfluencerActionsHistoryService} from '../src/modules/influencer-actions-history/influencer-actions-history.service';
import {SocialMediaEnum} from '../src/common/types/social-media.types';
import {MigrateSocialAccountData} from '../src/common/types/social-account-migration.types';
import {getArg} from './_migration-utils';

function readArgs(): MigrateSocialAccountData {
    const influencerId = getArg('influencer-id') ?? getArg('influencerId');
    const socialAccountToMigrateId = getArg('account-id') ?? getArg('socialAccountToMigrateId');
    const socialMediaOfAccount = getArg('social') ?? getArg('socialMediaOfAccount');

    if (!influencerId || !socialAccountToMigrateId || !socialMediaOfAccount) {
        throw new Error(
            'Usage: npm run migrate:social-account -- --influencer-id=<targetInfluencerId> --account-id=<socialAccountId> --social=<instagram|tiktok|spotify|soundcloud|facebook|youtube|press>',
        );
    }

    if (!Object.values(SocialMediaEnum).includes(socialMediaOfAccount as SocialMediaEnum)) {
        throw new Error(`Unsupported --social value: ${socialMediaOfAccount}`);
    }

    return {
        influencerId,
        socialAccountToMigrateId,
        socialMediaOfAccount: socialMediaOfAccount as SocialMediaEnum,
    };
}

async function main() {
    const data = readArgs();
    const app = await NestFactory.createApplicationContext(AppModule, {logger: ['error', 'warn', 'log']});

    try {
        const connection = app.get<Connection>(getConnectionToken());
        const profileService = app.get(ProfileService);
        const promosService = app.get(PromosService);
        const influencersHistoryService = app.get(InfluencerActionsHistoryService);

        const session = await connection.startSession();
        session.startTransaction();

        try {
            const context = await profileService.moveSocialAccount(data, session);
            console.log('Moved social account');

            await influencersHistoryService.moveSocialAccountHistory(context, session);
            console.log("Moved social account's actions history");

            await promosService.replaceInfluencerIdInOngoingPromos(context, session);
            console.log('Replaced influencerId in ongoing promos');

            await session.commitTransaction();
            console.log('Migration completed');
        } catch (e) {
            await session.abortTransaction();
            throw e;
        } finally {
            await session.endSession();
        }
    } finally {
        await app.close();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
