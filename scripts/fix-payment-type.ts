/**
 * Migrates legacy paymentType string values to the new CampaignPaymentMethodEnum.
 *
 * Mapping:
 *   'Bank card'     -> 'bank_card'
 *   'Bank transfer' -> 'bank_transfer_international'
 *   'Paypal'        -> 'paypal'
 */

import { connectMongo, disconnectMongo, getFlag } from './_migration-utils';

const COLLECTIONS = ['campaigns', 'completedcampaigns'];

const LEGACY_MAP: Record<string, string> = {
  'Bank card': 'bank_card',
  'Bank transfer': 'bank_transfer_international',
  Paypal: 'paypal',
};

async function fixPaymentType(
  db: any,
  collectionName: string,
  dryRun: boolean,
): Promise<{ total: number }> {
  const col = db.collection(collectionName);
  let total = 0;

  for (const [oldValue, newValue] of Object.entries(LEGACY_MAP)) {
    const count = await col.countDocuments({ paymentType: oldValue });
    if (!count) continue;

    console.log(`  "${oldValue}" -> "${newValue}": ${count} docs`);

    if (!dryRun) {
      await col.updateMany({ paymentType: oldValue }, { $set: { paymentType: newValue } });
    }

    total += count;
  }

  return { total };
}

async function main() {
  const dryRun = getFlag('dry-run') || getFlag('dryRun');
  console.log(`dryRun=${dryRun}`);

  const connection = await connectMongo();
  const db = connection.db;
  if (!db) throw new Error('No db');

  try {
    for (const collectionName of COLLECTIONS) {
      console.log(`\n--- ${collectionName} ---`);
      const stats = await fixPaymentType(db, collectionName, dryRun);
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
