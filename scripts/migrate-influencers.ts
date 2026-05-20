import {Types} from 'mongoose';
import {Collection} from 'mongodb';
import {SocialMediaEnum} from '../src/common/types/social-media.types';
import {AccountVerifiedStatus} from '../src/common/types/user.types';
import {
    connectMongo,
    disconnectMongo,
    getArg,
    getFlag,
    getIntArg,
    mapLegacyAccount,
    oid,
    parsePrice,
} from './_migration-utils';

const INFLUENCERS = 'influencers';

async function migrateInfluencers(influencers: Collection) {
    const limit = getIntArg('limit', 200);
    const dryRun = getFlag('dry-run') || getFlag('dryRun');
    let lastId = oid(getArg('start-after-id') ?? getArg('startAfterId'));

    let scanned = 0;
    let updated = 0;
    const socials = Object.values(SocialMediaEnum);

    while (true) {
        const filter: any = {
            $or: [{schemaVersion: {$exists: false}}, {schemaVersion: {$lt: 2}}],
        };
        if (lastId) filter._id = {$gt: lastId};

        const docs = await influencers.find(filter).sort({_id: 1}).limit(limit).toArray();
        if (!docs.length) break;

        const bulk: any[] = [];

        for (const doc of docs) {
            scanned++;
            lastId = doc._id as Types.ObjectId;

            const $set: any = {
                schemaVersion: 2,
                notificationMethods: {
                    whatsapp: false,
                    telegram: false,
                },
                verifiedStatus: doc.statusVerify === 'accept'
                    ? AccountVerifiedStatus.accept
                    : AccountVerifiedStatus.waitForAdmin,
                updatedAt: new Date(),
            };

            let touched = false;

            for (const social of socials) {
                const arr = Array.isArray(doc[social]) ? doc[social] : [];
                if (!arr.length) continue;

                $set[social] = arr.map((account: any) => mapLegacyAccount(account));
                touched = true;
            }

            const parsedBalance = parsePrice(doc.balance);
            if (parsedBalance !== null) {
                $set.balance = parsedBalance;
                touched = true;
            } else if (doc.balance !== undefined) {
                console.warn(`balance NOT converted influencer=${String(doc._id)} value=${JSON.stringify(doc.balance)}`);
            }

            if (dryRun) {
                console.log(`[dryRun] influencer=${String(doc._id)} touched=${touched}`);
                continue;
            }

            bulk.push({
                updateOne: {
                    filter: {_id: doc._id},
                    update: [{$set}],
                },
            });
        }

        if (!dryRun && bulk.length) {
            const res = await influencers.bulkWrite(bulk, {ordered: false});
            updated += res.modifiedCount ?? 0;
            console.log(`batch: scanned=${docs.length}, matched=${res.matchedCount}, modified=${res.modifiedCount}`);
        }
    }

    return {ok: true, dryRun, scanned, updated};
}

async function main() {
    const connection = await connectMongo();
    const db = connection.db;
    if (!db) throw new Error('No db');

    const result = await migrateInfluencers(db.collection(INFLUENCERS));
    console.log(JSON.stringify(result, null, 2));
    await disconnectMongo();
}

main().catch(async (e) => {
    console.error(e);
    await disconnectMongo().catch(() => undefined);
    process.exit(1);
});
