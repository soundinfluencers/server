import { Types } from 'mongoose';
import { Collection } from 'mongodb';
import { connectMongo, disconnectMongo, getArg, getFlag, getIntArg, oid } from './_migration-utils';

const DEFAULT_SOURCE = 'influenceractionshistories';
const DEFAULT_TARGET = 'influenceractionshistories';
const DEFAULT_CAMPAIGNS = 'completedcampaigns';

type AccountEntry = {
  addedAccountsId: Types.ObjectId;
  socialAccountId: Types.ObjectId | null;
  socialMedia: string;
  username: string;
};

type CampaignAccountMap = Map<string, AccountEntry[]>;

function buildCampaignAccountMap(campaignDocs: any[], influencerIdStr: string): CampaignAccountMap {
  const map: CampaignAccountMap = new Map();

  for (const doc of campaignDocs) {
    const campaignIdStr = String(doc._id);
    const entries: AccountEntry[] = [];

    for (const acc of Array.isArray(doc.addedAccounts) ? doc.addedAccounts : []) {
      if (String(acc.influencerId) !== influencerIdStr) continue;

      const addedAccountsId = oid(acc._id);
      if (!addedAccountsId) continue;

      entries.push({
        addedAccountsId,
        socialAccountId: oid(acc.accountId),
        socialMedia: (acc.socialMedia ?? '').toLowerCase(),
        username: (acc.username ?? '').toString().trim(),
      });
    }

    if (entries.length) map.set(campaignIdStr, entries);
  }

  return map;
}

function resolveAccount(
  entries: AccountEntry[],
  networkUsername: string,
  socialMedia: string | undefined,
): AccountEntry | null {
  if (!entries.length) return null;

  const username = networkUsername.trim();
  const sm = (socialMedia ?? '').toLowerCase();

  if (sm) {
    const exact = entries.find((e) => e.username === username && e.socialMedia === sm);
    if (exact) return exact;
  }

  const byUsername = entries.find((e) => e.username === username);
  if (byUsername) return byUsername;

  return entries[0];
}

async function migrateActionsHistory(
  source: Collection,
  target: Collection,
  campaignsColl: Collection,
  fallbackCampaignsColl: Collection,
) {
  const limit = getIntArg('limit', 50);
  const dryRun = getFlag('dry-run') || getFlag('dryRun');

  let lastId = oid(getArg('start-after-id') ?? getArg('startAfterId'));
  let scanned = 0;
  let upserted = 0;
  let skipped = 0;
  let unresolvedActions = 0;

  while (true) {
    const filter: any = {};
    if (lastId) filter._id = { $gt: lastId };

    const docs = await source.find(filter).sort({ _id: 1 }).limit(limit).toArray();
    if (!docs.length) break;

    const bulkOps: any[] = [];

    for (const doc of docs) {
      scanned++;
      lastId = doc._id as Types.ObjectId;

      const influencerId = oid(doc.influencerId);
      if (!influencerId) {
        console.warn(`skip history=${String(doc._id)}: missing influencerId`);
        skipped++;
        continue;
      }

      const influencerIdStr = String(influencerId);
      const campaigns: any[] = Array.isArray(doc.campaigns) ? doc.campaigns : [];
      const rawCampaignIds = campaigns
        .map((c: any) => oid(c.campaignId))
        .filter(Boolean) as Types.ObjectId[];

      const [primaryDocs, fallbackDocs] = await Promise.all([
        rawCampaignIds.length
          ? campaignsColl
              .find({ _id: { $in: rawCampaignIds } }, { projection: { _id: 1, addedAccounts: 1 } })
              .toArray()
          : [],
        rawCampaignIds.length
          ? fallbackCampaignsColl
              .find({ _id: { $in: rawCampaignIds } }, { projection: { _id: 1, addedAccounts: 1 } })
              .toArray()
          : [],
      ]);

      const campaignDocMap = new Map<string, any>();
      for (const c of [...fallbackDocs, ...primaryDocs]) campaignDocMap.set(String(c._id), c);
      const accountMap = buildCampaignAccountMap(
        Array.from(campaignDocMap.values()),
        influencerIdStr,
      );

      const migratedCampaigns = campaigns
        .map((camp: any) => {
          const campaignId = oid(camp.campaignId);
          if (!campaignId) return null;

          const entries = accountMap.get(String(campaignId)) ?? [];

          const actions = (Array.isArray(camp.actions) ? camp.actions : []).map((action: any) => {
            const resolved = resolveAccount(
              entries,
              action.networkUsername ?? '',
              action.socialMedia,
            );

            if (!resolved) {
              unresolvedActions++;
              console.warn(
                `unresolved action: history=${String(doc._id)} campaign=${String(campaignId)} username="${action.networkUsername}"`,
              );
            }

            return {
              _id: oid(action._id) ?? new Types.ObjectId(),
              addedAccountsId: resolved?.addedAccountsId ?? null,
              socialAccountId: resolved?.socialAccountId ?? null,
              actionNumber: action.actionNumber ?? 0,
              rewardForInfluencer: action.rewardForInfluencer ?? 0,
              networkUsername: action.networkUsername ?? '',
              socialMedia: action.socialMedia ?? resolved?.socialMedia ?? 'instagram',
              currentBalance: action.currentBalance ?? 0,
              date: action.date ?? new Date(),
              isStillInCampaign: action.isStillInCampaign ?? true,
            };
          });

          return {
            _id: oid(camp._id) ?? new Types.ObjectId(),
            campaignId,
            campaignName: camp.campaignName ?? '',
            actions,
          };
        })
        .filter(Boolean);

      const invoices = (Array.isArray(doc.invoices) ? doc.invoices : []).map((inv: any) => ({
        _id: oid(inv._id) ?? new Types.ObjectId(),
        invoiceId: oid(inv.invoiceId) ?? new Types.ObjectId(),
        amount: inv.amount ?? 0,
        paymentMethod: inv.paymentMethod ?? '',
        currentBalance: inv.currentBalance ?? 0,
        date: inv.date ?? new Date(),
      }));

      if (dryRun) {
        console.log(
          `[dryRun] history=${String(doc._id)} influencer=${influencerIdStr} campaigns=${migratedCampaigns.length} invoices=${invoices.length} unresolvedActions=${unresolvedActions}`,
        );
        continue;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              influencerId,
              influencerEmail: doc.influencerEmail ?? '',
              campaigns: migratedCampaigns,
              invoices,
              updatedAt: new Date(),
            },
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

  return { ok: true, dryRun, scanned, upserted, skipped, unresolvedActions };
}

async function main() {
  const sourceCollection =
    getArg('source-collection') ?? getArg('sourceCollection') ?? DEFAULT_SOURCE;
  const targetCollection =
    getArg('target-collection') ?? getArg('targetCollection') ?? DEFAULT_TARGET;
  const campaignsCollection =
    getArg('campaigns-collection') ?? getArg('campaignsCollection') ?? DEFAULT_CAMPAIGNS;
  const fallbackCampaignsCollection =
    getArg('fallback-campaigns-collection') ?? getArg('fallbackCampaignsCollection') ?? 'campaigns';

  const connection = await connectMongo();
  const db = connection.db;
  if (!db) throw new Error('No db');

  console.log(
    `source=${sourceCollection} -> target=${targetCollection} | campaigns=${campaignsCollection} fallback=${fallbackCampaignsCollection}`,
  );

  const result = await migrateActionsHistory(
    db.collection(sourceCollection),
    db.collection(targetCollection),
    db.collection(campaignsCollection),
    db.collection(fallbackCampaignsCollection),
  );

  console.log(
    JSON.stringify({ sourceCollection, targetCollection, campaignsCollection, ...result }, null, 2),
  );
  await disconnectMongo();
}

main().catch(async (e) => {
  console.error(e);
  await disconnectMongo().catch(() => undefined);
  process.exit(1);
});
