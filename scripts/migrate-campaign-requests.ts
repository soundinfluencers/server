import { Types } from 'mongoose';
import { Collection } from 'mongodb';
import { connectMongo, disconnectMongo, getArg, getFlag, getIntArg, oid } from './_migration-utils';

const CAMPAIGNS = 'campaigns';
const COMPLETED_CAMPAIGNS = 'completedcampaigns';
const CLIENTS = 'clients';
const ADMIN_REQUESTS = 'admin_requests';

function getSourceCollection(): string {
  return getArg('collection') ?? COMPLETED_CAMPAIGNS;
}

function mapVerifyToRequestState(verifyCampaign: string): {
  state: string;
  status: string;
  includeReviewedAt: boolean;
} {
  if (verifyCampaign === 'accept') {
    return { state: 'CLOSED', status: 'APPROVED', includeReviewedAt: true };
  }
  if (verifyCampaign === 'decline') {
    return { state: 'CLOSED', status: 'REJECTED', includeReviewedAt: true };
  }
  return { state: 'OPEN', status: 'WAITING_FOR_ADMIN', includeReviewedAt: false };
}

async function migrateCampaignRequests(
  campaigns: Collection,
  clients: Collection,
  adminRequests: Collection,
) {
  const limit = getIntArg('limit', 100);
  const dryRun = getFlag('dry-run') || getFlag('dryRun');

  let lastId = oid(getArg('start-after-id') ?? getArg('startAfterId'));
  let scanned = 0;
  let upserted = 0;
  let skipped = 0;

  while (true) {
    // Only target schema v2 campaigns — old docs lack sufficient information
    const filter: any = { schemaVersion: { $gte: 2 } };
    if (lastId) filter._id = { $gt: lastId };

    const docs = await campaigns.find(filter).sort({ _id: 1 }).limit(limit).toArray();
    if (!docs.length) break;

    // Batch-load client names
    const rawClientIds = docs.map((d: any) => String(d.clientId ?? '')).filter(Boolean);
    const uniqueClientIds = [...new Set(rawClientIds)].map((id) => new Types.ObjectId(id));

    const clientDocs = await clients
      .find({ _id: { $in: uniqueClientIds } }, { projection: { _id: 1, firstName: 1 } })
      .toArray();
    const clientMap = new Map(
      clientDocs.map((c: any) => [String(c._id), (c.firstName ?? '') as string]),
    );

    const bulkOps: any[] = [];

    for (const doc of docs) {
      scanned++;
      lastId = doc._id as Types.ObjectId;

      const campaignId = doc._id as Types.ObjectId;
      const clientId = oid(doc.clientId);

      if (!clientId) {
        console.warn(`skip campaign=${String(campaignId)}: no clientId`);
        skipped++;
        continue;
      }

      const verifyCampaign = (doc.verifyCampaign ?? 'wait').toString();
      const { state, status, includeReviewedAt } = mapVerifyToRequestState(verifyCampaign);
      const clientFirstName = clientMap.get(String(clientId)) ?? '';

      if (dryRun) {
        console.log(
          `[dryRun] campaign=${String(campaignId)} → state=${state}, status=${status}, client="${clientFirstName}"`,
        );
        continue;
      }

      const $set: any = {
        type: 'CAMPAIGN_REQUEST',
        state,
        status,
        userFirstName: clientFirstName,
        userRole: 'client',
        clientId,
        campaignId,
        updatedAt: new Date(),
      };
      if (includeReviewedAt) {
        $set.reviewedAt = doc.updatedAt ?? new Date();
      }

      bulkOps.push({
        updateOne: {
          filter: { campaignId, type: 'CAMPAIGN_REQUEST' },
          update: {
            $set,
            $setOnInsert: {
              _id: new Types.ObjectId(),
              createdAt: doc.createdAt ?? new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    if (!dryRun && bulkOps.length) {
      const res = await adminRequests.bulkWrite(bulkOps, { ordered: false });
      upserted += (res.upsertedCount ?? 0) + (res.modifiedCount ?? 0);
      console.log(
        `batch: scanned=${docs.length}, upserted=${res.upsertedCount}, modified=${res.modifiedCount}, skipped=${skipped}`,
      );
    }
  }

  return { ok: true, dryRun, scanned, upserted, skipped };
}

async function main() {
  const collectionName = getSourceCollection();
  const connection = await connectMongo();
  const db = connection.db;
  if (!db) throw new Error('No db');

  const result = await migrateCampaignRequests(
    db.collection(collectionName),
    db.collection(CLIENTS),
    db.collection(ADMIN_REQUESTS),
  );
  console.log(JSON.stringify({ collection: collectionName, ...result }, null, 2));
  await disconnectMongo();
}

main().catch(async (e) => {
  console.error(e);
  await disconnectMongo().catch(() => undefined);
  process.exit(1);
});
