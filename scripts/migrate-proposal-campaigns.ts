import { Types } from 'mongoose';
import { Collection } from 'mongodb';
import { CampaignContentItem } from '../src/database/schemas/campaign/campaign.schema';
import { ProposalCampaignAccount } from '../src/database/schemas/campaign/proposal-campaign-option.schema';
import { SocialMediaEnum } from '../src/common/types/social-media.types';
import { CurrencyCode } from '../src/common/types/finance.types';
import {
  InfluencerConfirmationStatusEnum,
  InfluencerPromoClosedStatusEnum,
} from '../src/common/types/influencer/promo.types';
import {
  connectMongo,
  disconnectMongo,
  getArg,
  getFlag,
  getInfluencerAccountMap,
  getIntArg,
  LegacyCampaignContentItem,
  LegacySelectedInfluencer,
  num,
  oid,
  socialField,
  toNumber,
} from './_migration-utils';

const PROPOSAL_CAMPAIGNS = 'proposalcampaigns';
const PROPOSAL_CAMPAIGN_OPTIONS = 'proposalcampaignoptions';
const INFLUENCERS = 'influencers';

function normalizeSocialMedia(value: string): SocialMediaEnum {
  const normalized = socialField(value);
  return Object.values(SocialMediaEnum).includes(normalized as SocialMediaEnum)
    ? (normalized as SocialMediaEnum)
    : SocialMediaEnum.instagram;
}

function resolveContentSocialMedia(c: any, doc: any, legacySelect: any[]) {
  const normalize = (v: any) => socialField((v ?? '').toString());
  const cSm = normalize(c?.socialMedia);

  if (Object.values(SocialMediaEnum).includes(cSm as SocialMediaEnum)) return cSm;

  const selectedSm = normalize(
    legacySelect.find(
      (acc: any) =>
        String(acc?.selectedContent?.campaignContentItemId ?? acc?.selectedCampaignContentItem) ===
        String(c?._id),
    )?.socialMedia,
  );

  if (Object.values(SocialMediaEnum).includes(selectedSm as SocialMediaEnum)) return selectedSm;

  const docSm = normalize(doc?.socialMedia);
  if (Object.values(SocialMediaEnum).includes(docSm as SocialMediaEnum)) return docSm;

  return SocialMediaEnum.instagram;
}

async function migrateProposalCampaigns(
  proposals: Collection,
  options: Collection,
  influencers: Collection,
) {
  const limit = getIntArg('limit', 100);
  const dryRun = getFlag('dry-run') || getFlag('dryRun');

  let lastId = oid(getArg('start-after-id') ?? getArg('startAfterId'));
  let scanned = 0;
  let createdOptions = 0;
  let updatedProposals = 0;
  let failed = 0;
  let missingAccountId = 0;
  const failedProposalIds: Types.ObjectId[] = [];

  while (true) {
    const filter: any = {
      $and: [
        { selectInfluencers: { $exists: true } },
        { campaignContent: { $exists: true } },
        { $or: [{ schemaVersion: { $exists: false } }, { schemaVersion: { $lt: 2 } }] },
      ],
    };
    if (lastId) filter._id = { $gt: lastId };

    const docs = await proposals.find(filter).sort({ _id: 1 }).limit(limit).toArray();
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

    for (const doc of docs) {
      scanned++;
      lastId = doc._id as Types.ObjectId;
      let insertedOptionId: Types.ObjectId | null = null;

      try {
        const optionId = new Types.ObjectId();
        const legacySelect: LegacySelectedInfluencer[] = Array.isArray(doc.selectInfluencers)
          ? doc.selectInfluencers
          : [];
        const legacyContent: LegacyCampaignContentItem[] = Array.isArray(doc.campaignContent)
          ? doc.campaignContent
          : [];

        const campaignContent = legacyContent.map((c) => {
          const descriptions =
            Array.isArray(c.postDescriptions) && c.postDescriptions.length
              ? c.postDescriptions.map((p) => {
                  const desc = (p?.description ?? '').toString().trim();
                  return {
                    _id: oid(p._id) ?? new Types.ObjectId(),
                    description: desc.length ? desc : 'change this',
                  };
                })
              : [
                  {
                    _id: new Types.ObjectId(),
                    description: (c?.postDescription ?? '').toString().trim().length
                      ? (c?.postDescription ?? '').toString().trim()
                      : 'change this',
                  },
                ];

          return {
            _id: oid(c._id) ?? new Types.ObjectId(),
            socialMedia: resolveContentSocialMedia(c, doc, legacySelect) as SocialMediaEnum,
            socialMediaGroup: c.socialMediaGroup ?? 'main',
            mainLink: c.mainLink ?? c.videoLink ?? '',
            descriptions,
            taggedUser: c.taggedUser ?? c.storyTag,
            taggedLink: c.taggedLink ?? c.swipeUpLink,
            additionalBrief: c.additionalBrief ?? c.specialWishes,
          } satisfies CampaignContentItem;
        });

        const addedAccounts: ProposalCampaignAccount[] = [];

        for (const acc of legacySelect) {
          const social = socialField(acc?.socialMedia);
          const username = (acc?.username ?? acc?.socialMediaUsername ?? '').toString().trim();
          const legacyInfluencerId = oid(acc?.influencerId);

          if (!social || !username) {
            console.warn(
              `skip account proposalId=${String(doc._id)} reason=invalid social=${social} username=${username}`,
            );
            continue;
          }

          const resolvedAccountId = legacyInfluencerId
            ? accountMap.get(`${String(legacyInfluencerId)}:${social}:${username}`)
            : undefined;
          if (!resolvedAccountId || !legacyInfluencerId) {
            missingAccountId++;
            console.warn(
              `skip account proposalId=${String(doc._id)} reason=cannot resolve account for ${social}:${username}`,
            );
            continue;
          }

          const selected = acc.selectedContent ?? acc.selectedCampaignContentItem;
          const selectedContentItemId =
            typeof selected === 'string' || selected instanceof Types.ObjectId
              ? oid(selected)
              : oid(selected?.campaignContentItemId);

          if (!selectedContentItemId) {
            console.warn(
              `skip account proposalId=${String(doc._id)} reason=cannot resolve selected content for ${social}:${username}`,
            );
            continue;
          }

          let selectedDescriptionId: Types.ObjectId | null =
            typeof selected === 'string' || selected instanceof Types.ObjectId
              ? null
              : oid(selected?.postDescriptionId);

          if (!selectedDescriptionId) {
            const found = campaignContent.find(
              (i) => String(i._id) === String(selectedContentItemId),
            );
            selectedDescriptionId = found?.descriptions?.[0]?._id ?? null;
          }

          if (!selectedDescriptionId) {
            console.warn(
              `skip account proposalId=${String(doc._id)} reason=cannot resolve selected content description for ${social}:${username}`,
            );
            continue;
          }

          addedAccounts.push({
            _id: oid(acc._id) ?? new Types.ObjectId(),
            influencerId: legacyInfluencerId,
            accountId: resolvedAccountId,
            socialMedia: normalizeSocialMedia(acc.socialMedia),
            username,
            price: num(acc.price) ?? 0,
            publicPrice: num(acc.publicPrice) ?? 0,
            followers: toNumber(acc.followers) ?? toNumber(acc.followersNumber) ?? 0,
            selectedContent: {
              campaignContentItemId: selectedContentItemId,
              descriptionId: selectedDescriptionId ?? undefined,
            },
            confirmation:
              (acc.confirmation as InfluencerConfirmationStatusEnum) ??
              InfluencerConfirmationStatusEnum.wait,
            closePromo:
              (acc.closePromo as InfluencerPromoClosedStatusEnum) ??
              InfluencerPromoClosedStatusEnum.wait,
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
            genres: acc.genres ?? [],
            countries: acc.countries ?? [],
          });
        }

        const optionDoc = {
          _id: optionId,
          proposalCampaignId: doc._id,
          creatorId: doc.clientId ?? doc.creatorId,
          creatorRole: doc.creatorRole ?? 'client',
          schemaVersion: 1,
          publicCampaignPrice: toNumber(doc.publicPrice) ?? 0,
          privateCampaignPrice: toNumber(doc.price) ?? 0,
          displayCurrency: CurrencyCode.EUR,
          addedAccounts,
          campaignContent,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        if (dryRun) {
          console.log(
            `[dryRun] proposal=${String(doc._id)} -> option=${String(optionId)}, addedAccounts=${addedAccounts.length}, content=${campaignContent.length}`,
          );
        } else {
          await options.insertOne(optionDoc);
          insertedOptionId = optionId;
          await proposals.updateOne(
            { _id: doc._id },
            {
              $set: {
                optionsIds: [optionId],
                schemaVersion: 2,
              },
              $unset: {
                selectInfluencers: 1,
                campaignContent: 1,
                price: 1,
                publicPrice: 1,
                totalFollowers: 1,
              },
            },
          );
        }

        createdOptions++;
        updatedProposals++;
      } catch (e: any) {
        failed++;
        console.error(
          `migrateProposalCampaigns failed: proposalId=${String(doc._id)} msg=${e?.message ?? e}`,
        );
        failedProposalIds.push(doc._id);
        if (!dryRun && insertedOptionId) {
          await options.deleteOne({ _id: insertedOptionId });
        }
      }
    }
  }

  return {
    ok: true,
    dryRun,
    scanned,
    createdOptions,
    updatedProposals,
    failed,
    missingAccountId,
    failedProposalIds,
  };
}

async function main() {
  const connection = await connectMongo();
  const db = connection.db;
  if (!db) throw new Error('No db');

  const result = await migrateProposalCampaigns(
    db.collection(PROPOSAL_CAMPAIGNS),
    db.collection(PROPOSAL_CAMPAIGN_OPTIONS),
    db.collection(INFLUENCERS),
  );
  console.log(JSON.stringify(result, null, 2));
  await disconnectMongo();
}

main().catch(async (e) => {
  console.error(e);
  await disconnectMongo().catch(() => undefined);
  process.exit(1);
});
