import { Types } from 'mongoose';
import { Collection } from 'mongodb';
import { AccountVerifiedStatus } from '../src/common/types/user.types';
import {
  connectMongo,
  disconnectMongo,
  getArg,
  getFlag,
  getIntArg,
  oid,
  parsePrice,
} from './_migration-utils';

const DEFAULT_SOURCE = 'users';
const DEFAULT_TARGET = 'clients';

function getSourceCollection(): string {
  return getArg('collection') ?? getArg('source-collection') ?? DEFAULT_SOURCE;
}

function getTargetCollection(): string {
  return getArg('target-collection') ?? getArg('target') ?? DEFAULT_TARGET;
}

function mapVerifiedStatus(statusVerify: unknown): AccountVerifiedStatus {
  switch (statusVerify) {
    case 'accept':
      return AccountVerifiedStatus.accept;
    case 'decline':
      return AccountVerifiedStatus.decline;
    default:
      return AccountVerifiedStatus.waitForAdmin;
  }
}

async function migrateClients(source: Collection, target: Collection) {
  const limit = getIntArg('limit', 200);
  const dryRun = getFlag('dry-run') || getFlag('dryRun');
  let lastId = oid(getArg('start-after-id') ?? getArg('startAfterId'));

  let scanned = 0;
  let upserted = 0;
  let skipped = 0;

  while (true) {
    const filter: any = {
      role: 'client',
      $or: [{ schemaVersion: { $exists: false } }, { schemaVersion: { $lt: 2 } }],
    };
    if (lastId) filter._id = { $gt: lastId };

    const docs = await source.find(filter).sort({ _id: 1 }).limit(limit).toArray();
    if (!docs.length) break;

    const bulkOps: any[] = [];

    for (const doc of docs) {
      scanned++;
      lastId = doc._id as Types.ObjectId;

      if (!doc.email) {
        console.warn(`skip client=${String(doc._id)}: missing email`);
        skipped++;
        continue;
      }

      const parsedBalance = parsePrice(doc.balance);
      const balance = parsedBalance !== null ? parsedBalance : 0;

      const $set: any = {
        schemaVersion: 2,
        role: 'client',
        firstName: doc.firstName ?? '',
        balance,
        company: doc.company ?? '',
        companyType: doc.companyType ?? '',
        instagramUsername: doc.instagramUsername ?? '',
        email: (doc.email as string).toLowerCase(),
        phone: doc.phone ?? '',
        referalCode: doc.referalCode ?? '',
        password: doc.password ?? '',
        referenceNumber: doc.referenceNumber ?? '',
        logo: doc.logo ?? '',
        isProposalClient: doc.isProposalClient ?? false,
        verifiedStatus: mapVerifiedStatus(doc.statusVerify),
        internalNote: doc.internalNote ?? '',
        refreshToken: doc.refreshToken ?? null,
        updatedAt: new Date(),
      };

      if (doc.lastName != null) $set.lastName = doc.lastName;
      if (doc.logoUrl != null) $set.logoUrl = doc.logoUrl;

      if (dryRun) {
        console.log(
          `[dryRun] client=${String(doc._id)} email=${doc.email} verifiedStatus=${$set.verifiedStatus}`,
        );
        continue;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set,
            $setOnInsert: {
              createdAt: doc.createdAt ?? new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    if (!dryRun && bulkOps.length) {
      const res = await target.bulkWrite(bulkOps, { ordered: false });
      upserted += (res.upsertedCount ?? 0) + (res.modifiedCount ?? 0);
      console.log(
        `batch: scanned=${docs.length}, upserted=${res.upsertedCount}, modified=${res.modifiedCount}, skipped=${skipped}`,
      );
    }
  }

  return { ok: true, dryRun, scanned, upserted, skipped };
}

async function main() {
  const sourceCollection = getSourceCollection();
  const targetCollection = getTargetCollection();

  const connection = await connectMongo();
  const db = connection.db;
  if (!db) throw new Error('No db');

  console.log(`Migrating clients: ${sourceCollection} → ${targetCollection}`);

  const result = await migrateClients(
    db.collection(sourceCollection),
    db.collection(targetCollection),
  );

  console.log(JSON.stringify({ sourceCollection, targetCollection, ...result }, null, 2));
  await disconnectMongo();
}

main().catch(async (e) => {
  console.error(e);
  await disconnectMongo().catch(() => undefined);
  process.exit(1);
});
