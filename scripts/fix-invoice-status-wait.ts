/**
 * Sets invoiceStatus='wait' on addedAccounts entries that are accepted and closed
 * but have no invoiceStatus set (migrated campaigns). This unblocks influencers from
 * creating invoices via the standard flow.
 *
 * Eligible accounts: confirmation=accept, closePromo=close, invoiceStatus absent/null.
 *
 * Run once after campaign migration, then re-run migrate:payment-history if needed.
 */

import { connectMongo, disconnectMongo, getFlag, getIntArg, oid } from './_migration-utils';
import { Types } from 'mongoose';

const COLLECTIONS = ['campaigns', 'completedcampaigns'];

async function fixInvoiceStatus(
  db: any,
  collectionName: string,
  opts: { dryRun: boolean; batchSize: number },
): Promise<{ scanned: number; campaignsPatched: number; accountsPatched: number }> {
  const col = db.collection(collectionName);

  let scanned = 0;
  let campaignsPatched = 0;
  let accountsPatched = 0;
  let lastId: Types.ObjectId | null = null;

  while (true) {
    const filter: any = {
      addedAccounts: {
        $elemMatch: {
          confirmation: 'accept',
          closePromo: 'close',
          $or: [{ invoiceStatus: { $exists: false } }, { invoiceStatus: null }],
        },
      },
    };
    if (lastId) filter._id = { $gt: lastId };

    const docs = await col.find(filter).sort({ _id: 1 }).limit(opts.batchSize).toArray();
    if (!docs.length) break;

    const bulkOps: any[] = [];

    for (const doc of docs) {
      scanned++;
      lastId = doc._id as Types.ObjectId;

      const eligible = (Array.isArray(doc.addedAccounts) ? doc.addedAccounts : []).filter(
        (acc: any) =>
          acc.confirmation === 'accept' &&
          acc.closePromo === 'close' &&
          (acc.invoiceStatus === null || acc.invoiceStatus === undefined),
      );

      if (!eligible.length) continue;

      if (opts.dryRun) {
        console.log(
          `[dryRun] ${collectionName}/${String(doc._id)} campaignName="${doc.campaignName}" accounts=${eligible.length}`,
        );
        accountsPatched += eligible.length;
        campaignsPatched++;
        continue;
      }

      const eligibleIds = eligible.map((acc: any) => oid(acc._id)).filter(Boolean);

      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              'addedAccounts.$[elem].invoiceStatus': 'wait',
            },
          },
          arrayFilters: [
            {
              'elem._id': { $in: eligibleIds },
            },
          ],
        },
      });

      accountsPatched += eligible.length;
      campaignsPatched++;
    }

    if (!opts.dryRun && bulkOps.length) {
      const res = await col.bulkWrite(bulkOps, { ordered: false });
      console.log(
        `batch: scanned=${docs.length} matched=${res.matchedCount} modified=${res.modifiedCount}`,
      );
    }
  }

  return { scanned, campaignsPatched, accountsPatched };
}

async function main() {
  const dryRun = getFlag('dry-run') || getFlag('dryRun');
  const batchSize = getIntArg('limit', 100);

  console.log(`dryRun=${dryRun} batchSize=${batchSize}`);

  const connection = await connectMongo();
  const db = connection.db;
  if (!db) throw new Error('No db');

  try {
    for (const collectionName of COLLECTIONS) {
      console.log(`\n--- ${collectionName} ---`);
      const stats = await fixInvoiceStatus(db, collectionName, { dryRun, batchSize });
      console.log(JSON.stringify({ collection: collectionName, ...stats }, null, 2));
    }
  } finally {
    await disconnectMongo();
  }
}

main().catch(async (e) => {
  console.error(e);
  await disconnectMongo().catch(() => undefined);
  process.exit(1);
});
