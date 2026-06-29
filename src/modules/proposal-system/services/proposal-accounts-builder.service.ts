import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { uniq } from 'lodash';
import { InfluencerRepository } from '../../../database/repositories/users/influencer.repository';
import { SelectInfluencerDto } from '../../campaigns/dto/create-campaign.dto';
import { ProposalCampaignAccount } from '../../../database/schemas/campaign/proposal-campaign-option.schema';
import { SocialMediaEnum } from '../../../common/types/social-media.types';
import { AccountVerifiedStatus } from '../../../common/types/user.types';
import {
  InfluencerConfirmationStatusEnum,
  InfluencerPromoClosedStatusEnum,
} from '../../../common/types/influencer/promo.types';
import { ObjId, toObjIdSafe } from '../../../common/types/base.types';
import {
  CommunityMusicGenres,
  CreatorMusicGenres,
  InfluencerProfileCategory,
} from 'src/common/types/influencer/influencer.types';

type AccountKey = string;
type UsernameKey = string;

type MinimalSocialAccount = {
  _id: ObjId;
  username?: string;
  followers?: number;
  price?: number;
  publicPrice?: number;
  verifiedStatus?: AccountVerifiedStatus;
  isDeleted?: boolean;
  isHidden?: boolean;
  profileCategory?: InfluencerProfileCategory;
  communityMusicGenres?: CommunityMusicGenres[];
  creatorMusicGenres?: CreatorMusicGenres[];
  countries?: object[];
};

type MinimalInfluencer = {
  _id: ObjId;
} & Partial<Record<SocialMediaEnum, MinimalSocialAccount[]>>;

export type ProposalAccountsBatchResult = {
  accounts: ProposalCampaignAccount[];
  publicCampaignPrice: number;
  privateCampaignPrice: number;
};

@Injectable()
export class ProposalAccountsBuilderService {
  constructor(private readonly influencerRepo: InfluencerRepository) {}

  async buildProposalAccountsBatch(
    addedAccountsData: SelectInfluencerDto[],
  ): Promise<ProposalAccountsBatchResult> {
    if (!addedAccountsData?.length) {
      return { accounts: [], publicCampaignPrice: 0, privateCampaignPrice: 0 };
    }

    const usedSocialMedia = uniq(addedAccountsData.map((a) => a.socialMedia).filter(Boolean));

    const influencerIdStrs = uniq(addedAccountsData.map((a) => a.influencerId).filter(Boolean));
    const influencerIds = influencerIdStrs.map(toObjIdSafe).filter((x): x is ObjId => Boolean(x));

    const socialAccountIdStrs = uniq(
      addedAccountsData.map((a) => a.socialAccountId).filter(Boolean),
    );
    const socialAccountIds = socialAccountIdStrs
      .map(toObjIdSafe)
      .filter((x): x is ObjId => Boolean(x));

    const usernamesByMedia = new Map<SocialMediaEnum, string[]>();
    for (const a of addedAccountsData) {
      if (!a.username) continue;
      const arr = usernamesByMedia.get(a.socialMedia) ?? [];
      arr.push(a.username);
      usernamesByMedia.set(a.socialMedia, arr);
    }
    for (const [sm, arr] of usernamesByMedia) {
      usernamesByMedia.set(sm, uniq(arr));
    }

    const projection: Record<string, 1> = { _id: 1 };
    for (const sm of usedSocialMedia) projection[sm] = 1;

    const influencers: MinimalInfluencer[] = influencerIds.length
      ? await this.influencerRepo.findMany({ _id: { $in: influencerIds } }, {
          lean: true,
          select: Object.keys(projection),
        } as any)
      : [];

    const hasMissingInfluencerId = addedAccountsData.some((a) => !a.influencerId);
    if (hasMissingInfluencerId) {
      const or: any[] = [];
      if (socialAccountIds.length) {
        for (const sm of usedSocialMedia) {
          or.push({ [`${sm}._id`]: { $in: socialAccountIds } });
        }
      }
      for (const [sm, names] of usernamesByMedia) {
        if (names.length) or.push({ [`${sm}.username`]: { $in: names } });
      }
      if (or.length) {
        const extra: MinimalInfluencer[] = await this.influencerRepo.findMany({ $or: or }, {
          lean: true,
          select: Object.keys(projection),
        } as any);
        const seen = new Set(influencers.map((i) => i._id.toString()));
        for (const inf of extra) {
          if (!seen.has(inf._id.toString())) {
            influencers.push(inf);
            seen.add(inf._id.toString());
          }
        }
      }
    }

    if (!influencers.length) {
      return { accounts: [], publicCampaignPrice: 0, privateCampaignPrice: 0 };
    }

    const byAccountId = new Map<AccountKey, { influencerId: ObjId; acc: MinimalSocialAccount }>();
    const byUsername = new Map<UsernameKey, { influencerId: ObjId; acc: MinimalSocialAccount }>();

    for (const inf of influencers) {
      for (const sm of usedSocialMedia) {
        const arr = inf[sm];
        if (!Array.isArray(arr) || !arr.length) continue;
        for (const acc of arr) {
          if (!acc?._id) continue;
          byAccountId.set(`${sm}:${acc._id.toString()}`, { influencerId: inf._id, acc });
          if (acc.username) {
            byUsername.set(`${sm}:${acc.username}`, { influencerId: inf._id, acc });
          }
        }
      }
    }

    const result: ProposalCampaignAccount[] = [];
    let publicCampaignPrice = 0;
    let privateCampaignPrice = 0;

    for (const dto of addedAccountsData) {
      const dtoAccountId = toObjIdSafe(dto.socialAccountId);
      const dtoInfluencerId = toObjIdSafe(dto.influencerId);

      let matched: { influencerId: ObjId; acc: MinimalSocialAccount } | null = null;

      if (dtoAccountId) {
        matched = byAccountId.get(`${dto.socialMedia}:${dtoAccountId.toString()}`) ?? null;
      } else if (dto.username) {
        matched = byUsername.get(`${dto.socialMedia}:${dto.username}`) ?? null;
      }

      if (!matched) continue;
      if (dtoInfluencerId && matched.influencerId.toString() !== dtoInfluencerId.toString())
        continue;

      const acc = matched.acc;
      if (acc.verifiedStatus !== AccountVerifiedStatus.accept) continue;
      if (acc.isDeleted || acc.isHidden) continue;
      if (
        typeof acc.price !== 'number' ||
        acc.price < 0 ||
        typeof acc.publicPrice !== 'number' ||
        acc.publicPrice < 0
      )
        continue;
      if (!dto.selectedCampaignContentItem?.campaignContentItemId) continue;

      publicCampaignPrice += acc.publicPrice;
      privateCampaignPrice += acc.price;

      // normalizing communityMusicGenres/creatorMusicGenres
      let accountMusicGenres: CommunityMusicGenres[] | CreatorMusicGenres[] | undefined = undefined;

      switch (acc.profileCategory) {
        case InfluencerProfileCategory.community:
          if (acc?.communityMusicGenres?.length > 0) {
            accountMusicGenres = acc.communityMusicGenres;
          }
          break;
        case InfluencerProfileCategory.creator:
          if (acc?.creatorMusicGenres?.length > 0) {
            accountMusicGenres = acc.creatorMusicGenres;
          }
          break;
        default:
          break;
      }

      result.push({
        ...dto,
        _id: new Types.ObjectId(),
        username: acc.username ?? dto.username,
        influencerId: matched.influencerId,
        accountId: acc._id,
        followers: acc.followers ?? 0,
        price: acc.price,
        publicPrice: acc.publicPrice,
        selectedContent: {
          campaignContentItemId: new Types.ObjectId(
            dto.selectedCampaignContentItem.campaignContentItemId,
          ),
          descriptionId: dto.selectedCampaignContentItem.descriptionId
            ? new Types.ObjectId(dto.selectedCampaignContentItem.descriptionId)
            : undefined,
        },
        confirmation: InfluencerConfirmationStatusEnum.wait,
        closePromo: InfluencerPromoClosedStatusEnum.wait,
        dateRequest: dto.dateRequest ?? null,
        genres: accountMusicGenres ? accountMusicGenres : [],
        countries: acc.countries ?? [],
      } satisfies ProposalCampaignAccount);
    }

    return { accounts: result, publicCampaignPrice, privateCampaignPrice };
  }
}
