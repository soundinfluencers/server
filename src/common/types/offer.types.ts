import { CommunityMusicGenres, CreatorMusicGenres } from './influencer/influencer.types';

export enum OfferSocialMediaEnum {
  instagram = 'instagram',
  tiktok_creators = 'tiktok_creators',
  tiktok_communities = 'tiktok_communities',
  facebook = 'facebook',
  youtube = 'youtube',
  spotify = 'spotify',
  soundcloud = 'soundcloud',
  press = 'press',
}

// Offer social media labels for UI
export const offerSocialMediaLabels: Record<OfferSocialMediaEnum, string> = {
  instagram: 'Instagram',
  tiktok_creators: 'TikTok Creators',
  tiktok_communities: 'TikTok Communities',
  facebook: 'Facebook',
  youtube: 'YouTube',
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  press: 'Press',
};

export const OFFER_GENRES_BY_SOCIAL_MEDIA: Record<OfferSocialMediaEnum, readonly string[]> = {
  [OfferSocialMediaEnum.instagram]: Object.values(CommunityMusicGenres),
  [OfferSocialMediaEnum.tiktok_communities]: Object.values(CommunityMusicGenres),
  [OfferSocialMediaEnum.tiktok_creators]: Object.values(CreatorMusicGenres),
  [OfferSocialMediaEnum.facebook]: Object.values(CommunityMusicGenres),
  [OfferSocialMediaEnum.youtube]: Object.values(CommunityMusicGenres),
  [OfferSocialMediaEnum.spotify]: Object.values(CommunityMusicGenres),
  [OfferSocialMediaEnum.soundcloud]: Object.values(CommunityMusicGenres),
  [OfferSocialMediaEnum.press]: Object.values(CommunityMusicGenres),
};

export function isOfferSocialMedia(value: unknown): value is OfferSocialMediaEnum {
  return (
    typeof value === 'string' &&
    Object.values(OfferSocialMediaEnum).includes(value as OfferSocialMediaEnum)
  );
}

export function isGenreAllowedForOfferSocialMedia(params: {
  socialMedia: OfferSocialMediaEnum;
  genre: string;
}): boolean {
  const allowedGenres = OFFER_GENRES_BY_SOCIAL_MEDIA[params.socialMedia];
  return Boolean(allowedGenres?.includes(params.genre));
}
