/**
 * Finds accounts that were in selectInfluencers (dump) but were skipped during
 * campaign migration (not present in addedAccounts in the new DB). Tries to resolve
 * their accountId from the new DB's influencers collection, then adds them back.
 *
 * After this script, re-run migrate:payment-history to create the missing payment cells.
 *
 * Dump DB (DUMP_DATABASE_ROOT):
 *   promos        -> campaigns          in main DB
 *   promoscopies  -> completedcampaigns in main DB
 */

import mongoose, { Types } from 'mongoose';
import {
  getArg,
  getFlag,
  getInfluencerAccountMap,
  getIntArg,
  LegacySelectedInfluencer,
  oid,
  socialField,
} from './_migration-utils';
import {
  InfluencerConfirmationStatusEnum,
  InfluencerPromoClosedStatusEnum,
} from '../src/common/types/influencer/promo.types';
import { SocialMediaEnum } from '../src/common/types/social-media.types';

const COLLECTION_MAP: Array<{ dump: string; main: string }> = [
  { dump: 'promos', main: 'campaigns' },
  { dump: 'promoscopies', main: 'completedcampaigns' },
];

const INFLUENCERS = 'influencers';
const SOCIAL_FIELDS = [
  'instagram',
  'tiktok',
  'spotify',
  'soundcloud',
  'facebook',
  'youtube',
  'press',
] as const;

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

function normalizeSocialMedia(value: string): SocialMediaEnum {
  const s = socialField(value);
  return Object.values(SocialMediaEnum).includes(s as SocialMediaEnum)
    ? (s as SocialMediaEnum)
    : SocialMediaEnum.instagram;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const digits = v.trim().replace(/[^\d.]/g, '');
    if (!digits) return null;
    const n = Number(digits);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Resolves selectedContent for the missing account.
 * Tries to match by campaignContentItemId from the dump; falls back to first content item.
 */
function resolveSelectedContent(
  acc: LegacySelectedInfluencer,
  newDoc: any,
): { campaignContentItemId: Types.ObjectId; descriptionId: Types.ObjectId } | undefined {
  const campaignContent: any[] = Array.isArray(newDoc.campaignContent)
    ? newDoc.campaignContent
    : [];
  if (!campaignContent.length) return undefined;

  const selected = acc.selectedContent ?? acc.selectedCampaignContentItem;
  const rawContentId =
    typeof selected === 'string' || selected instanceof Types.ObjectId
      ? oid(selected)
      : oid((selected as any)?.campaignContentItemId);

  const rawDescriptionId =
    typeof selected === 'string' || selected instanceof Types.ObjectId
      ? null
      : oid((selected as any)?.postDescriptionId);

  const contentItem = rawContentId
    ? campaignContent.find((c) => String(c._id) === String(rawContentId))
    : campaignContent[0];

  const resolvedContentItem = contentItem ?? campaignContent[0];
  if (!resolvedContentItem) return undefined;

  const descriptions: any[] = Array.isArray(resolvedContentItem.descriptions)
    ? resolvedContentItem.descriptions
    : [];

  const descriptionId = rawDescriptionId ?? (descriptions.length ? oid(descriptions[0]._id) : null);

  if (!descriptionId) return undefined;

  return {
    campaignContentItemId: oid(resolvedContentItem._id)!,
    descriptionId,
  };
}

async function fixMissingAccounts(
  dumpConn: mongoose.Connection,
  mainConn: mongoose.Connection,
  dumpCollectionName: string,
  mainCollectionName: string,
  opts: { dryRun: boolean; batchSize: number },
): Promise<{
  scanned: number;
  campaignsPatched: number;
  accountsAdded: number;
  accountsUnresolvable: number;
}> {
  const dumpCol = dumpConn.collection(dumpCollectionName);
  const mainCol = mainConn.collection(mainCollectionName);
  const influencersCol = mainConn.collection(INFLUENCERS);

  let scanned = 0;
  let campaignsPatched = 0;
  let accountsAdded = 0;
  let accountsUnresolvable = 0;

  let lastId: Types.ObjectId | null = null;

  while (true) {
    const filter: any = {};
    if (lastId) filter._id = { $gt: lastId };

    const dumpDocs = await dumpCol.find(filter).sort({ _id: 1 }).limit(opts.batchSize).toArray();

    if (!dumpDocs.length) break;

    // Load corresponding new-DB docs in one batch
    const dumpIds = dumpDocs.map((d) => d._id);
    const newDocs = await mainCol.find({ _id: { $in: dumpIds } }).toArray();
    const newDocMap = new Map<string, any>(newDocs.map((d) => [String(d._id), d]));

    // Collect influencer IDs needed to build account map
    const influencerIdSet = new Set<string>();
    for (const dumpDoc of dumpDocs) {
      for (const acc of Array.isArray(dumpDoc.selectInfluencers) ? dumpDoc.selectInfluencers : []) {
        const id = oid(acc?.influencerId);
        if (id) influencerIdSet.add(String(id));
      }
    }

    const influencerDocs = influencerIdSet.size
      ? await influencersCol
          .find(
            { _id: { $in: [...influencerIdSet].map((id) => new Types.ObjectId(id)) } },
            { projection: { _id: 1, ...Object.fromEntries(SOCIAL_FIELDS.map((s) => [s, 1])) } },
          )
          .toArray()
      : [];

    const accountMap = getInfluencerAccountMap(influencerDocs);

    const bulkOps: any[] = [];

    for (const dumpDoc of dumpDocs) {
      scanned++;
      lastId = dumpDoc._id as Types.ObjectId;

      const newDoc = newDocMap.get(String(dumpDoc._id));
      if (!newDoc) {
        // Deleted after migration — skip
        continue;
      }

      const legacySelect: LegacySelectedInfluencer[] = Array.isArray(dumpDoc.selectInfluencers)
        ? dumpDoc.selectInfluencers
        : [];

      // Build set of addedAccounts._id already in the new doc
      const existingIds = new Set<string>(
        (Array.isArray(newDoc.addedAccounts) ? newDoc.addedAccounts : []).map((a: any) =>
          String(oid(a._id) ?? a._id),
        ),
      );

      // Accounts present in dump but missing from new doc
      const missing = legacySelect.filter(
        (acc) => !existingIds.has(String(oid(acc._id) ?? acc._id)),
      );

      if (!missing.length) continue;

      const toAdd: any[] = [];

      for (const acc of missing) {
        const influencerId = oid(acc.influencerId);
        const social = socialField(acc.socialMedia ?? '');
        const username = (acc.username ?? acc.socialMediaUsername ?? '').toString().trim();

        // Try original accountId first, then lookup by influencerId:social:username
        let resolvedAccountId = oid(acc.accountId);
        if (!resolvedAccountId && influencerId && username) {
          const key = `${String(influencerId)}:${social}:${username}`;
          resolvedAccountId = accountMap.get(key) ?? null;
        }

        if (!influencerId || !resolvedAccountId) {
          accountsUnresolvable++;
          console.warn(
            `unresolvable: ${mainCollectionName}/${String(dumpDoc._id)} ` +
              `influencer=${String(influencerId)} ${social}:${username}`,
          );
          continue;
        }

        const selectedContent = resolveSelectedContent(acc, newDoc);

        if (!selectedContent) {
          accountsUnresolvable++;
          console.warn(
            `no selectedContent: ${mainCollectionName}/${String(dumpDoc._id)} ` +
              `influencer=${String(influencerId)} ${social}:${username}`,
          );
          continue;
        }

        toAdd.push({
          _id: oid(acc._id) ?? new Types.ObjectId(),
          influencerId,
          accountId: resolvedAccountId,
          socialMedia: normalizeSocialMedia(acc.socialMedia ?? ''),
          username,
          price: num(acc.price) ?? 0,
          publicPrice: num(acc.publicPrice) ?? 0,
          followers: (acc as any).followers ?? acc.followersNumber ?? 0,
          confirmation:
            (acc.confirmation as InfluencerConfirmationStatusEnum) ??
            InfluencerConfirmationStatusEnum.wait,
          closePromo:
            (acc.closePromo as InfluencerPromoClosedStatusEnum) ??
            InfluencerPromoClosedStatusEnum.wait,
          selectedContent,
          dateRequest: acc.dateRequest ?? undefined,
          datePost: acc.datePost ?? undefined,
          postLink: acc.postLink ?? undefined,
          screenshot: acc.screenshot ?? undefined,
          impressions: num(acc.impressions) ?? undefined,
          like: num(acc.like) ?? undefined,
          comments: num(acc.comments) ?? undefined,
          shares: num(acc.shares) ?? undefined,
          saves: num(acc.saves) ?? undefined,
          rating: num(acc.rating) ?? undefined,
          adminChecked: acc.adminChecked ?? false,
          createdAt: (acc as any).createdAt ?? new Date(),
          updatedAt: (acc as any).updatedAt ?? new Date(),
        });
      }

      if (!toAdd.length) continue;

      accountsAdded += toAdd.length;
      campaignsPatched++;

      if (opts.dryRun) {
        for (const a of toAdd) {
          console.log(
            `[dryRun] ${mainCollectionName}/${String(dumpDoc._id)} ` +
              `add account=${String(a.accountId)} ${a.socialMedia}:${a.username}`,
          );
        }
        continue;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: dumpDoc._id },
          update: { $push: { addedAccounts: { $each: toAdd } } },
        },
      });
    }

    if (!opts.dryRun && bulkOps.length) {
      const res = await mainCol.bulkWrite(bulkOps, { ordered: false });
      console.log(
        `batch: scanned=${dumpDocs.length} matched=${res.matchedCount} modified=${res.modifiedCount}`,
      );
    }
  }

  return { scanned, campaignsPatched, accountsAdded, accountsUnresolvable };
}

async function main() {
  const dryRun = getFlag('dry-run') || getFlag('dryRun');
  const batchSize = getIntArg('limit', 100);

  console.log(`dryRun=${dryRun} batchSize=${batchSize}`);

  const dumpConn = await mongoose.createConnection(getDumpUri()).asPromise();
  const mainConn = await mongoose.createConnection(getMainUri()).asPromise();

  try {
    for (const { dump, main } of COLLECTION_MAP) {
      console.log(`\n--- ${dump} -> ${main} ---`);
      const stats = await fixMissingAccounts(dumpConn, mainConn, dump, main, { dryRun, batchSize });
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
