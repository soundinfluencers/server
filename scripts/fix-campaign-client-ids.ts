/**
 * Fixes clientId on migrated campaigns by reading the original values from the dump database.
 *
 * Dump DB (DUMP_DATABASE_ROOT):
 *   promos        -> maps to -> campaigns          in main DB
 *   promoscopies  -> maps to -> completedcampaigns in main DB
 *
 * Documents are matched by _id. Missing docs in main DB are silently skipped.
 */

import mongoose, { Types } from 'mongoose';
import { getArg, getFlag, oid } from './_migration-utils';

const COLLECTION_MAP: Array<{ dump: string; main: string }> = [
  { dump: 'promos', main: 'campaigns' },
  { dump: 'promoscopies', main: 'completedcampaigns' },
];

function getDumpUri(): string {
  const uri = process.env.DUMP_DATABASE_ROOT;
  if (!uri) throw new Error('DUMP_DATABASE_ROOT is not set');
  return uri;
}

function getMainUri(): string {
  const uri = process.env.DATABASE_ROOT;
  if (!uri) throw new Error('DATABASE_ROOT is not set');
  return uri;
}

async function fixClientIds(
  dumpConn: mongoose.Connection,
  mainConn: mongoose.Connection,
  dumpCollectionName: string,
  mainCollectionName: string,
  opts: { dryRun: boolean; limit: number },
): Promise<{ scanned: number; updated: number; skipped: number; noClientId: number }> {
  const dumpCol = dumpConn.collection(dumpCollectionName);
  const mainCol = mainConn.collection(mainCollectionName);

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let noClientId = 0;

  const batchSize = opts.limit;
  let lastId: Types.ObjectId | null = null;

  while (true) {
    const filter: any = {};
    if (lastId) filter._id = { $gt: lastId };

    const docs = await dumpCol.find(filter).sort({ _id: 1 }).limit(batchSize).toArray();
    if (!docs.length) break;

    for (const doc of docs) {
      scanned++;
      lastId = doc._id as Types.ObjectId;

      const rawClientId = doc.clientId ?? doc.userId;
      if (!rawClientId) {
        noClientId++;
        console.warn(`no clientId in dump: ${dumpCollectionName}/${String(doc._id)}`);
        continue;
      }

      const clientId = oid(
        typeof rawClientId === 'object' && rawClientId !== null && '$oid' in rawClientId
          ? rawClientId.$oid
          : rawClientId,
      );

      if (!clientId) {
        noClientId++;
        console.warn(
          `cannot parse clientId "${rawClientId}" for dump: ${dumpCollectionName}/${String(doc._id)}`,
        );
        continue;
      }

      if (opts.dryRun) {
        console.log(
          `[dryRun] ${mainCollectionName}/${String(doc._id)} -> clientId=${String(clientId)}`,
        );
        updated++;
        continue;
      }

      const result = await mainCol.updateOne({ _id: doc._id }, { $set: { clientId } });

      if (result.matchedCount === 0) {
        skipped++;
        console.log(`skip (not found in main): ${mainCollectionName}/${String(doc._id)}`);
      } else {
        updated++;
      }
    }
  }

  return { scanned, updated, skipped, noClientId };
}

async function main() {
  const dryRun = getFlag('dry-run') || getFlag('dryRun');
  const limit = (() => {
    const raw = getArg('limit');
    if (!raw) return 200;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 200;
  })();

  console.log(`dryRun=${dryRun} batchSize=${limit}`);

  const dumpConn = await mongoose.createConnection(getDumpUri()).asPromise();
  const mainConn = await mongoose.createConnection(getMainUri()).asPromise();

  try {
    for (const { dump, main } of COLLECTION_MAP) {
      console.log(`\n--- ${dump} -> ${main} ---`);
      const stats = await fixClientIds(dumpConn, mainConn, dump, main, { dryRun, limit });
      console.log(JSON.stringify({ dump, main, ...stats }, null, 2));
    }
  } finally {
    await dumpConn.close();
    await mainConn.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
