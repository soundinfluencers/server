/**
 * One-off migration: copy offer.connectedAccounts into offer_account_links, then $unset connectedAccounts.
 * Run from server/: npx ts-node -r tsconfig-paths/register scripts/migrate-offer-account-links.ts
 * Requires MONGO_URI (or same env as the app uses — adjust connect string below).
 */
import mongoose from 'mongoose';

const OFFERS = 'offers';
const LINKS = 'offer_account_links';

async function main() {
    const uri = process.env.DATABASE_ROOT;
    if (!uri) {
        console.error('Set DATABASE_ROOT');
        process.exit(1);
    }

    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    if (!db) {
        throw new Error('No db');
    }

    const offers = db.collection(OFFERS);
    const links = db.collection(LINKS);

    const cursor = offers.find({
        connectedAccounts: {$exists: true, $type: 'array', $not: {$size: 0}},
    });

    let offerCount = 0;
    let linkCount = 0;

    for await (const doc of cursor) {
        const accounts = doc.connectedAccounts as
            | {influencerId?: mongoose.Types.ObjectId; accountId?: mongoose.Types.ObjectId}[]
            | undefined;
        if (!accounts?.length) continue;

        const bulk = accounts
            .filter((a) => a?.influencerId && a?.accountId)
            .map((a) => ({
                offerId: doc._id,
                influencerId: a.influencerId,
                accountId: a.accountId,
                createdAt: new Date(),
                updatedAt: new Date(),
            }));

        if (bulk.length) {
            try {
                await links.insertMany(bulk, {ordered: false});
                linkCount += bulk.length;
            } catch (e: unknown) {
                const err = e as {writeErrors?: {code?: number}[]};
                if (err.writeErrors?.some((we) => we.code === 11000)) {
                    // duplicate key — ignore
                } else {
                    throw e;
                }
            }
        }

        await offers.updateOne({_id: doc._id}, {$unset: {connectedAccounts: ''}});
        offerCount += 1;
    }

    console.log(`Migrated ${offerCount} offers, inserted ~${linkCount} links (duplicates may be skipped).`);
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
