import { Types } from 'mongoose';
import { Collection } from 'mongodb';
import { connectMongo, disconnectMongo, getArg, getFlag, getIntArg, oid } from './_migration-utils';

const CAMPAIGNS = 'campaigns';
const COMPLETED_CAMPAIGNS = 'completedcampaigns';
const INFLUENCERS = 'influencers';
const PAYMENT_HISTORY_CELLS = 'paymenthistorycells';

function getSourceCollection(): string {
  return getArg('collection') ?? COMPLETED_CAMPAIGNS;
}

function getCampaignSource(collectionName: string): 'campaign' | 'completed' {
  const explicit = getArg('source') as 'campaign' | 'completed' | undefined;
  if (explicit === 'campaign' || explicit === 'completed') return explicit;
  return collectionName === CAMPAIGNS ? 'campaign' : 'completed';
}

// Mirrors PaymentsHistoryService.resolveSystemStatus()
function resolveSystemStatus(acc: any): 'in_process' | 'done' {
  const isAccepted = acc.confirmation === 'accept';
  const isCompleted = acc.closePromo === 'close';
  const sentInvoice = acc.invoiceStatus === 'submitted' || acc.invoiceStatus === 'paid';

  if (isAccepted && isCompleted && sentInvoice) return 'done';
  return 'in_process';
}

// Mirrors PaymentsHistoryService.resolveEffectiveStatus()
function resolveEffectiveStatus(systemStatus: 'in_process' | 'done'): 'in_process' | 'done' {
  return systemStatus === 'done' ? 'done' : 'in_process';
}

async function migratePaymentHistory(
  campaigns: Collection,
  influencers: Collection,
  paymentHistoryCells: Collection,
  campaignSource: 'campaign' | 'completed',
) {
  const limit = getIntArg('limit', 100);
  const dryRun = getFlag('dry-run') || getFlag('dryRun');

  let lastId = oid(getArg('start-after-id') ?? getArg('startAfterId'));
  let scanned = 0;
  let upserted = 0;
  let skippedNoAccounts = 0;

  while (true) {
    // Only target schema v2 campaigns — old-format selectInfluencers docs lack accountId
    const filter: any = {
      schemaVersion: { $gte: 2 },
      addedAccounts: { $exists: true, $ne: [] },
    };
    if (lastId) filter._id = { $gt: lastId };

    const docs = await campaigns.find(filter).sort({ _id: 1 }).limit(limit).toArray();
    if (!docs.length) break;

    // Batch-load influencer snapshots for all accounts in this batch
    const influencerIdSet = new Set<string>();
    for (const doc of docs) {
      for (const acc of Array.isArray(doc.addedAccounts) ? doc.addedAccounts : []) {
        const id = oid(acc.influencerId);
        if (id) influencerIdSet.add(String(id));
      }
    }

    const influencerDocs = await influencers
      .find(
        { _id: { $in: [...influencerIdSet].map((id) => new Types.ObjectId(id)) } },
        { projection: { _id: 1, firstName: 1, email: 1, logoUrl: 1 } },
      )
      .toArray();

    type InfluencerSnapshot = {
      influencerName: string;
      influencerEmail?: string;
      influencerLogoUrl?: string;
    };
    const influencerMap = new Map<string, InfluencerSnapshot>(
      influencerDocs.map((inf: any) => [
        String(inf._id),
        {
          influencerName: inf.firstName ?? 'Unknown',
          influencerEmail: inf.email ?? undefined,
          influencerLogoUrl: inf.logoUrl ?? undefined,
        },
      ]),
    );

    const bulkOps: any[] = [];

    for (const doc of docs) {
      scanned++;
      lastId = doc._id as Types.ObjectId;

      const addedAccounts: any[] = Array.isArray(doc.addedAccounts) ? doc.addedAccounts : [];
      if (addedAccounts.length === 0) {
        skippedNoAccounts++;
        continue;
      }

      for (const acc of addedAccounts) {
        const accountId = oid(acc.accountId);
        const influencerId = oid(acc.influencerId);

        if (!accountId || !influencerId) {
          console.warn(
            `skip account in campaign=${String(doc._id)}: missing accountId or influencerId`,
          );
          continue;
        }

        const snapshot = influencerMap.get(String(influencerId)) ?? {
          influencerName: 'Unknown',
          influencerEmail: undefined,
          influencerLogoUrl: undefined,
        };

        const systemStatus = resolveSystemStatus(acc);
        const effectiveStatus = resolveEffectiveStatus(systemStatus);

        if (dryRun) {
          console.log(
            `[dryRun] campaign=${String(doc._id)} account=${String(accountId)} → systemStatus=${systemStatus}`,
          );
          continue;
        }

        const $set: any = {
          campaignSource,
          campaignId: doc._id,
          accountId,
          influencerId,
          campaignName: doc.campaignName ?? '',
          campaignCreatedAt: doc.createdAt ?? new Date(),
          campaignStatus: doc.statusCampaign ?? 'under_review',
          socialMedia: acc.socialMedia,
          username: acc.username ?? '',
          price: acc.price ?? 0,
          systemStatus,
          effectiveStatus,
          updatedAt: new Date(),
          influencerName: snapshot.influencerName,
        };
        if (acc.followers != null) $set.followers = acc.followers;
        if (acc.invoiceStatus) $set.invoiceStatus = acc.invoiceStatus;
        if (snapshot.influencerEmail) $set.influencerEmail = snapshot.influencerEmail;
        if (snapshot.influencerLogoUrl) $set.influencerLogoUrl = snapshot.influencerLogoUrl;

        bulkOps.push({
          updateOne: {
            filter: { campaignId: doc._id, accountId },
            update: {
              $set,
              $setOnInsert: {
                _id: new Types.ObjectId(),
                createdAt: new Date(),
              },
            },
            upsert: true,
          },
        });
      }
    }

    if (!dryRun && bulkOps.length) {
      const res = await paymentHistoryCells.bulkWrite(bulkOps, { ordered: false });
      upserted += (res.upsertedCount ?? 0) + (res.modifiedCount ?? 0);
      console.log(
        `batch: scanned=${docs.length}, upserted=${res.upsertedCount}, modified=${res.modifiedCount}, skippedNoAccounts=${skippedNoAccounts}`,
      );
    }
  }

  return { ok: true, dryRun, scanned, upserted, skippedNoAccounts };
}

async function main() {
  const collectionName = getSourceCollection();
  const campaignSource = getCampaignSource(collectionName);
  const connection = await connectMongo();
  const db = connection.db;
  if (!db) throw new Error('No db');

  const result = await migratePaymentHistory(
    db.collection(collectionName),
    db.collection(INFLUENCERS),
    db.collection(PAYMENT_HISTORY_CELLS),
    campaignSource,
  );
  console.log(JSON.stringify({ collection: collectionName, campaignSource, ...result }, null, 2));
  await disconnectMongo();
}

main().catch(async (e) => {
  console.error(e);
  await disconnectMongo().catch(() => undefined);
  process.exit(1);
});
