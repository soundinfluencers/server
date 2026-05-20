import { Types } from 'mongoose';
import { Collection } from 'mongodb';
import {
  CampaignAccount,
  CampaignContentItem,
} from '../src/database/schemas/campaign/campaign.schema';
import { SocialMediaEnum } from '../src/common/types/social-media.types';
import {
  InfluencerConfirmationStatusEnum,
  InfluencerPromoClosedStatusEnum,
} from '../src/common/types/influencer/promo.types';
import { CampaignStatusEnum } from '../src/common/types/client/campaign.types';
import { CurrencyCode } from '../src/common/types/finance.types';
import {
  connectMongo,
  disconnectMongo,
  getArg,
  getFlag,
  getInfluencerAccountMap,
  getIntArg,
  getLegacyCampaignFields,
  LegacyCampaignContentItem,
  LegacySelectedInfluencer,
  mapCampaignStatus,
  mapCampaignVerify,
  num,
  oid,
  socialField,
} from './_migration-utils';

const CAMPAIGNS = 'campaigns';
const COMPLETED_CAMPAIGNS = 'completedcampaigns';
const INFLUENCERS = 'influencers';

function normalizeSocialMedia(value: string): SocialMediaEnum {
  const normalized = socialField(value);
  return Object.values(SocialMediaEnum).includes(normalized as SocialMediaEnum)
    ? (normalized as SocialMediaEnum)
    : SocialMediaEnum.instagram;
}

function getSourceCollection(): string {
  return getArg('collection') ?? COMPLETED_CAMPAIGNS;
}

function getWriteCollection(sourceCollection: string): string {
  const target = getArg('target-collection') ?? getArg('targetCollection');
  if (target) return target;
  return sourceCollection === COMPLETED_CAMPAIGNS ? CAMPAIGNS : COMPLETED_CAMPAIGNS;
}

async function migrateCampaigns(source: Collection, target: Collection, influencers: Collection) {
  const limit = getIntArg('limit', 100);
  const dryRun = getFlag('dry-run') || getFlag('dryRun');

  let lastId = oid(getArg('start-after-id') ?? getArg('startAfterId'));
  let scanned = 0;
  let updated = 0;
  let skippedAccounts = 0;
  let missingAccountId = 0;
  let missingSelectedContentId = 0;

  while (true) {
    const filter: any = {
      $and: [
        { selectInfluencers: { $exists: true } },
        { campaignContent: { $exists: true } },
        { $or: [{ schemaVersion: { $exists: false } }, { schemaVersion: { $lt: 2 } }] },
      ],
    };
    if (lastId) filter._id = { $gt: lastId };

    const docs = await source.find(filter).sort({ _id: 1 }).limit(limit).toArray();
    if (!docs.length) break;

    const influencerIds = Array.from(
      new Set(
        docs
          .flatMap((d: any) => (Array.isArray(d.selectInfluencers) ? d.selectInfluencers : []))
          .map((a: any) => oid(a?.influencerId))
          .filter(Boolean)
          .map((x) => String(x)),
      ),
    ).map((id) => new Types.ObjectId(id));

    const influencerDocs = await influencers
      .find(
        { _id: { $in: influencerIds } },
        {
          projection: {
            _id: 1,
            instagram: 1,
            tiktok: 1,
            spotify: 1,
            soundcloud: 1,
            facebook: 1,
            youtube: 1,
            press: 1,
          },
        },
      )
      .toArray();

    const accountMap = getInfluencerAccountMap(influencerDocs);
    const bulk: any[] = [];

    for (const doc of docs) {
      scanned++;
      lastId = doc._id as Types.ObjectId;

      const legacySelect: LegacySelectedInfluencer[] = doc.selectInfluencers ?? [];
      const legacyContent: LegacyCampaignContentItem[] = doc.campaignContent ?? [];

      const campaignContent = legacyContent.map((c) => {
        const descriptions: { _id: Types.ObjectId; description: string }[] =
          Array.isArray(c.postDescriptions) && c.postDescriptions.length > 0
            ? c.postDescriptions.map((p) => ({
                _id: p._id instanceof Types.ObjectId ? p._id : new Types.ObjectId(p._id),
                description: p.description,
              }))
            : [
                {
                  _id: new Types.ObjectId(),
                  description: c.postDescription ?? '',
                },
              ];

        return {
          _id: oid(c._id) ?? new Types.ObjectId(),
          socialMedia: normalizeSocialMedia(c.socialMedia),
          socialMediaGroup: c.socialMediaGroup ?? 'main',
          mainLink: c.mainLink ?? c.videoLink ?? '',
          descriptions,
          taggedUser: c.taggedUser ?? c.storyTag,
          taggedLink: c.taggedLink ?? c.swipeUpLink,
          additionalBrief: c.additionalBrief ?? c.specialWishes,
        } satisfies CampaignContentItem;
      });

      const addedAccounts: CampaignAccount[] = [];

      for (const acc of legacySelect) {
        const influencerId = oid(acc.influencerId);
        const social = socialField(acc.socialMedia);
        const username = (acc.username ?? acc.socialMediaUsername ?? '').toString().trim();

        let resolvedAccountId = oid(acc.accountId);
        if (!resolvedAccountId && influencerId && username) {
          const key = `${String(influencerId)}:${social}:${username}`;
          resolvedAccountId = accountMap.get(key) ?? null;
        }

        if (!influencerId || !resolvedAccountId) {
          missingAccountId++;
          skippedAccounts++;
          console.warn(
            `skip account campaign=${String(doc._id)} reason=cannot resolve account for ${social}:${username}`,
          );
          continue;
        }

        const selected = acc.selectedContent ?? acc.selectedCampaignContentItem;
        const selectedContentItemId =
          typeof selected === 'string' || selected instanceof Types.ObjectId
            ? oid(selected)
            : oid(selected?.campaignContentItemId);

        const selectedDescriptionId =
          typeof selected === 'string' || selected instanceof Types.ObjectId
            ? (campaignContent.find((i) => String(i._id) === String(selectedContentItemId))
                ?.descriptions?.[0]?._id ?? null)
            : oid(selected?.postDescriptionId);
        const resolvedDescriptionId =
          selectedDescriptionId ??
          campaignContent.find((i) => String(i._id) === String(selectedContentItemId))
            ?.descriptions?.[0]?._id ??
          null;

        if (!selectedContentItemId) {
          missingSelectedContentId++;
          skippedAccounts++;
          console.warn(
            `skip account campaign=${String(doc._id)} reason=cannot resolve selected content for ${social}:${username}`,
          );
          continue;
        }

        if (!resolvedDescriptionId) {
          skippedAccounts++;
          console.warn(
            `skip account campaign=${String(doc._id)} reason=cannot resolve selected content description for ${social}:${username}`,
          );
          continue;
        }

        addedAccounts.push({
          _id: oid(acc._id) ?? new Types.ObjectId(),
          influencerId,
          accountId: resolvedAccountId,
          socialMedia: normalizeSocialMedia(acc.socialMedia),
          username,
          price: num(acc.price) ?? 0,
          publicPrice: num(acc.publicPrice) ?? 0,
          followers: acc.followers ?? acc.followersNumber ?? 0,
          confirmation:
            (acc.confirmation as InfluencerConfirmationStatusEnum) ??
            InfluencerConfirmationStatusEnum.wait,
          closePromo:
            (acc.closePromo as InfluencerPromoClosedStatusEnum) ??
            InfluencerPromoClosedStatusEnum.wait,
          selectedContent: {
            campaignContentItemId: selectedContentItemId,
            descriptionId: resolvedDescriptionId,
          },
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
          createdAt: (acc as any).createdAt,
          updatedAt: (acc as any).updatedAt,
        });
      }

      const { legacyStatus, legacyVerify } = getLegacyCampaignFields(doc);
      const verifyCampaign = mapCampaignVerify(legacyVerify);
      const statusCampaign = mapCampaignStatus(legacyStatus, legacyVerify);
      const clientId =
        process.env.NODE_ENV === 'development'
          ? oid('66a747a89c6e78a6cffb83b4')
          : doc.clientId
            ? oid(doc.clientId)
            : oid(doc.userId);

      const migratedDoc: any = {
        ...doc,
        clientId,
        addedAccounts,
        campaignContent,
        paymentStatus: 'confirmed',
        verifyCampaign,
        statusCampaign,
        schemaVersion: 2,
        adminMeta: {
          reportSent: statusCampaign === CampaignStatusEnum.completed,
        },
        displayCurrency: CurrencyCode.EUR,
      };

      delete migratedDoc.selectInfluencers;
      delete migratedDoc.statusPromo;
      delete migratedDoc.verifyPromo;

      if (dryRun) {
        console.log(
          `[dryRun] ${String(doc._id)} -> addedAccounts=${addedAccounts.length}, content=${campaignContent.length}`,
        );
        continue;
      }

      bulk.push({ insertOne: { document: migratedDoc } });
    }

    if (!dryRun && bulk.length) {
      const res = await target.bulkWrite(bulk, { ordered: false });
      updated += res.insertedCount ?? 0;
      console.log(`batch: scanned=${docs.length}, inserted=${res.insertedCount}`);
    }
  }

  return {
    ok: true,
    dryRun,
    scanned,
    updated,
    skippedAccounts,
    missingAccountId,
    missingSelectedContentId,
  };
}

async function main() {
  const sourceCollectionName = getSourceCollection();
  const targetCollectionName = getWriteCollection(sourceCollectionName);
  const connection = await connectMongo();
  const db = connection.db;
  if (!db) throw new Error('No db');

  console.log(`source=${sourceCollectionName} -> target=${targetCollectionName}`);
  const result = await migrateCampaigns(
    db.collection(sourceCollectionName),
    db.collection(targetCollectionName),
    db.collection(INFLUENCERS),
  );
  console.log(
    JSON.stringify(
      { source: sourceCollectionName, target: targetCollectionName, ...result },
      null,
      2,
    ),
  );
  await disconnectMongo();
}

main().catch(async (e) => {
  console.error(e);
  await disconnectMongo().catch(() => undefined);
  process.exit(1);
});
