import { Types } from 'mongoose';
import { Collection } from 'mongodb';
import { connectMongo, disconnectMongo, getArg, getFlag, getIntArg, oid } from './_migration-utils';

const DEFAULT_SOURCE = 'invoices';
const DEFAULT_TARGET = 'userinvoices';

const STATUS_MAP: Record<string, string> = {
  Submitted: 'submitted',
  Paid: 'paid',
  Cancelled: 'cancelled',
  Wait: 'wait',
};

function normalizeStatus(raw: string | undefined): string {
  if (!raw) return 'submitted';
  return STATUS_MAP[raw] ?? raw.toLowerCase();
}

function resolvePaymentMethod(doc: any): string {
  const explicit = doc.selectedPaymentMethod ?? doc.paymentMethod;
  if (explicit) return explicit;
  if (doc.ukBankTransfer && Object.keys(doc.ukBankTransfer).length) return 'ukBankTransfer';
  if (doc.paypal && Object.keys(doc.paypal).length) return 'paypal';
  return 'internationalBankTransfer';
}

async function migrateInfluencerInvoices(source: Collection, target: Collection) {
  const limit = getIntArg('limit', 100);
  const dryRun = getFlag('dry-run') || getFlag('dryRun');

  let lastId = oid(getArg('start-after-id') ?? getArg('startAfterId'));
  let scanned = 0;
  let upserted = 0;
  let skipped = 0;

  while (true) {
    const filter: any = {};
    if (lastId) filter._id = { $gt: lastId };

    const docs = await source.find(filter).sort({ _id: 1 }).limit(limit).toArray();
    if (!docs.length) break;

    const bulkOps: any[] = [];

    for (const doc of docs) {
      scanned++;
      lastId = doc._id as Types.ObjectId;

      const userId = oid(doc.influencerId ?? doc.userId);
      if (!userId) {
        console.warn(`skip invoice=${String(doc._id)}: cannot resolve userId`);
        skipped++;
        continue;
      }

      const status = normalizeStatus(doc.status);
      const selectedPaymentMethod = resolvePaymentMethod(doc);

      if (dryRun) {
        console.log(
          `[dryRun] invoice=${String(doc._id)} influencer=${String(userId)} status=${status} paymentMethod=${selectedPaymentMethod}`,
        );
        continue;
      }

      const $set: any = {
        userId,
        userRole: 'influencer',
        schemaVersion: 2,
        status,
        selectedPaymentMethod,
        firstName: doc.firstName ?? '',
        lastName: doc.lastName ?? '',
        address: doc.address ?? '',
        country: doc.country ?? '',
        amount: doc.amount ?? 0,
        linkedPromos: Array.isArray(doc.linkedPromos) ? doc.linkedPromos : [],
        updatedAt: new Date(),
      };
      if (doc.company != null) $set.company = doc.company;
      if (doc.vatNumber != null) $set.vatNumber = doc.vatNumber;
      if (doc.ukBankTransfer) $set.ukBankTransfer = doc.ukBankTransfer;
      if (doc.internationalBankTransfer)
        $set.internationalBankTransfer = doc.internationalBankTransfer;
      if (doc.paypal) $set.paypal = doc.paypal;

      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set,
            $setOnInsert: {
              _id: doc._id,
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
  const sourceCollection =
    getArg('source-collection') ?? getArg('sourceCollection') ?? DEFAULT_SOURCE;
  const targetCollection =
    getArg('target-collection') ?? getArg('targetCollection') ?? DEFAULT_TARGET;

  const connection = await connectMongo();
  const db = connection.db;
  if (!db) throw new Error('No db');

  console.log(`source=${sourceCollection} -> target=${targetCollection}`);
  const result = await migrateInfluencerInvoices(
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
