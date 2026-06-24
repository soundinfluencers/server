import { Influencer, SocialAccount } from '../../database/schemas/users/influencer.schema';
import {
  InfluencerAccountDetailsDto,
  SocialAccountDetailsDto,
  SocialAccountForAccountDetailsDto,
} from '../../modules/profile/dto/influencer/get-profile.dto';
import { AccountVerifiedStatus } from '../types/user.types';
import { CurrencyCode } from '../types/finance.types';
import {
  AdminInfluencerListItem,
  InfluencerProfileCategory,
} from '../types/influencer/influencer.types';
import { AdminSocialAccountForListDto } from '../../modules/admin/dto/influencers/admin-influencers.dto';
import { InternalServerErrorException } from '@nestjs/common';
import { SocialMediaEnum } from '../types/social-media.types';

// Maps social account doc to social account for account details dto
export const mapSocialAccountToAccountDetailsDto = (
  account: SocialAccount,
): SocialAccountForAccountDetailsDto => {
  return {
    accountId: account._id.toString(),
    username: account.username,
    labelStatus: account.labelStatus,
  };
};

// Filters deleted accounts
const filterSocialAccounts = (accounts?: SocialAccount[]): SocialAccountForAccountDetailsDto[] => {
  return (
    accounts
      ?.filter((acc) => !acc.isDeleted && acc.verifiedStatus !== AccountVerifiedStatus.decline)
      .map(mapSocialAccountToAccountDetailsDto) ?? []
  );
};

// Maps influencer doc to influencer account details dto
export const mapInfluencerToAccountDetailsDto = (
  influencer: Influencer,
): InfluencerAccountDetailsDto => {
  return {
    firstName: influencer.firstName,
    lastName: influencer.lastName ?? null,
    logoUrl: influencer.logoUrl ?? null,
    email: influencer.email,
    phone: influencer.phone,
    notificationMethods: influencer.notificationMethods ?? { whatsapp: true, telegram: true },

    instagram: filterSocialAccounts(influencer.instagram),
    tiktok: filterSocialAccounts(influencer.tiktok),
    spotify: filterSocialAccounts(influencer.spotify),
    youtube: filterSocialAccounts(influencer.youtube),
    facebook: filterSocialAccounts(influencer.facebook),
    soundcloud: filterSocialAccounts(influencer.soundcloud),
    press: filterSocialAccounts(influencer.press),
  };
};

// Maps social account doc to social account details dto
export const mapToSocialAccountDetailsDto = (account: SocialAccount): SocialAccountDetailsDto => {
  return {
    accountId: account._id.toString(),
    username: account.username,
    profileLink: account.profileLink,
    followers: account.followers,
    logoUrl: account.logoUrl,
    profileCategory: account.profileCategory,
    initialPrice: account.initialPrice ?? null,
    currency: account.currency || CurrencyCode.EUR,
    countries: account.countries,
    engagementRate: account.engagementRate ?? 0,
    averageViews: account.averageViews ?? 0,
    ...(account?.profileCategory === InfluencerProfileCategory.community &&
    account?.communityMusicGenres?.length > 0
      ? { communityMusicGenres: account.communityMusicGenres }
      : {}),
    ...(account?.profileCategory === InfluencerProfileCategory.community &&
    account?.communityThemeTopics?.length > 0
      ? { communityThemeTopics: account.communityThemeTopics }
      : {}),
    ...(account?.profileCategory === InfluencerProfileCategory.creator &&
    account?.creatorMusicGenres?.length > 0
      ? { creatorMusicGenres: account.creatorMusicGenres }
      : {}),
    ...(account?.profileCategory === InfluencerProfileCategory.creator &&
    account?.creatorContentFocus?.length > 0
      ? { creatorContentFocus: account.creatorContentFocus }
      : {}),
  };
};

// Maps influencer model to AdminInfluencerListItem
export const mapToAdminInfluencerListItem = (
  influencer: Influencer,
  accountId: string,
): AdminInfluencerListItem => {
  let account: SocialAccount = null;
  let foundSocialMedia: SocialMediaEnum = null;

  for (const socialMedia of Object.values(SocialMediaEnum)) {
    if (!influencer[socialMedia] || influencer[socialMedia]?.length === 0) continue;

    account = influencer[socialMedia].find((acc) => acc._id.toString() === accountId) ?? null;
    if (account) {
      foundSocialMedia = socialMedia;
      break;
    }
  }

  if (!account || !foundSocialMedia)
    throw new InternalServerErrorException('Social account not found.');

  return {
    influencerId: influencer._id,
    firstName: influencer.firstName,
    lastName: influencer.lastName ?? '',
    email: influencer.email,
    phone: influencer.phone,
    balance: influencer.balance,
    accountId: account._id,
    username: account.username,
    socialMedia: foundSocialMedia,
    logoUrl: account.logoUrl ?? null,
    followers: account.followers,
    profileLink: account.profileLink,
    publicPrice: account.publicPrice,
    price: account.price,
    initialPrice: account.initialPrice,
    currency: account.currency,
    costPerFollower: Number((account.price / account.followers)?.toFixed(6)) ?? 0,
    isHidden: account.isHidden,
    ...(influencer.internalNote !== null ? { internalNote: influencer.internalNote } : undefined),
  } satisfies AdminInfluencerListItem;
};

// Maps AdminInfluencerListItem read model to AdminSocialAccountForListDto
export const mapToAdminSocialAccountForListDto = (
  account: AdminInfluencerListItem,
): AdminSocialAccountForListDto => {
  return {
    influencerId: account.influencerId.toString(),
    firstName: account.firstName,
    lastName: account.lastName ?? '',
    email: account.email,
    phone: account.phone,
    balance: account.balance,
    accountId: account.accountId.toString(),
    username: account.username,
    socialMedia: account.socialMedia,
    logoUrl: account.logoUrl ?? null,
    followers: account.followers,
    profileLink: account.profileLink,
    publicPrice: account.publicPrice,
    price: account.price,
    initialPrice: account.initialPrice,
    currency: account.currency,
    costPerFollower: account.costPerFollower,
    isHidden: account.isHidden,
    ...(account.internalNote !== null ? { internalNote: account.internalNote } : undefined),
  } satisfies AdminSocialAccountForListDto;
};
