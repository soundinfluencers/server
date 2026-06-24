import {
  CommunityMusicGenres,
  CommunityThemeTopics,
  CreatorContentFocus,
  CreatorMusicGenres,
} from '../types/influencer/influencer.types';

export const COMMUNITY_MUSIC_GENRE_LABELS: Record<CommunityMusicGenres, string> = {
  [CommunityMusicGenres.TECHNO_MELODIC_MINIMAL]: 'Melodic, Minimal',
  [CommunityMusicGenres.TECHNO_HARD_PEAK]: 'Hard, Peak',
  [CommunityMusicGenres.HOUSE_TECH_HOUSE]: 'Tech House',
  [CommunityMusicGenres.HOUSE_MELODIC_AFRO]: 'Melodic, Afro',
  [CommunityMusicGenres.EDM]: 'EDM',
  [CommunityMusicGenres.DRUM_AND_BASS]: 'D&B',
  [CommunityMusicGenres.BASS]: 'Bass',
  [CommunityMusicGenres.PSY_TRANCE]: 'Psy, Trance',
  [CommunityMusicGenres.DUBSTEP]: 'Dubstep',
  [CommunityMusicGenres.HIP_HOP]: 'Hip-hop',
  [CommunityMusicGenres.POP]: 'Pop',
};

export const COMMUNITY_THEME_TOPIC_LABELS: Record<CommunityThemeTopics, string> = {
  [CommunityThemeTopics.IBIZA]: 'Ibiza',
  [CommunityThemeTopics.DANCING]: 'Dancing',
  [CommunityThemeTopics.MEME]: 'Meme',
};

export const CREATOR_MUSIC_GENRE_LABELS: Record<CreatorMusicGenres, string> = {
  [CreatorMusicGenres.ELECTRONIC_TECHNO_MELODIC_MINIMAL]: 'Melodic, Minimal',
  [CreatorMusicGenres.ELECTRONIC_TECHNO_HARD_PEAK]: 'Hard, Peak',
  [CreatorMusicGenres.ELECTRONIC_HOUSE_TECH_HOUSE]: 'Tech House',
  [CreatorMusicGenres.ELECTRONIC_HOUSE_MELODIC_AFRO]: 'Melodic, Afro',
  [CreatorMusicGenres.ELECTRONIC_EDM]: 'EDM',
  [CreatorMusicGenres.ELECTRONIC_DRUM_AND_BASS]: 'D&B',
  [CreatorMusicGenres.ELECTRONIC_BASS]: 'Bass',
  [CreatorMusicGenres.ELECTRONIC_PSY_TRANCE]: 'Psy, Trance',
  [CreatorMusicGenres.ELECTRONIC_DUBSTEP]: 'Dubstep',

  [CreatorMusicGenres.MAINSTREAM_POP]: 'Pop',
  [CreatorMusicGenres.MAINSTREAM_HIP_HOP]: 'Hip-hop',
  [CreatorMusicGenres.MAINSTREAM_ARABIC]: 'Arabic',
  [CreatorMusicGenres.MAINSTREAM_K_POP]: 'K-Pop',
  [CreatorMusicGenres.MAINSTREAM_METAL_ROCK]: 'Metal/Rock',
  [CreatorMusicGenres.MAINSTREAM_LATIN]: 'Latin',
};

export const CREATOR_CONTENT_FOCUS_LABELS: Record<CreatorContentFocus, string> = {
  [CreatorContentFocus.MUSIC_DANCE]: 'Dance',
  [CreatorContentFocus.MUSIC_LIPSYNC]: 'Lipsync',
  [CreatorContentFocus.MUSIC_REACTIONS]: 'Reactions',
  [CreatorContentFocus.MUSIC_LYRICS]: 'Lyrics',

  [CreatorContentFocus.ENTERTAINMENT_LIFESTYLE]: 'Lifestyle',
  [CreatorContentFocus.ENTERTAINMENT_FASHION]: 'Fashion',
  [CreatorContentFocus.ENTERTAINMENT_FITNESS_SPORT]: 'Fitness/Sport',
  [CreatorContentFocus.ENTERTAINMENT_BEAUTY]: 'Beauty',
  [CreatorContentFocus.ENTERTAINMENT_TRAVEL]: 'Travel',
  [CreatorContentFocus.ENTERTAINMENT_FAMILY]: 'Family',
  [CreatorContentFocus.ENTERTAINMENT_COMEDY]: 'Comedy',
  [CreatorContentFocus.ENTERTAINMENT_COSPLAY]: 'Cosplay',
  [CreatorContentFocus.ENTERTAINMENT_FOOD]: 'Food',
  [CreatorContentFocus.ENTERTAINMENT_ART]: 'Art',
};

export function mapAccountGenresToLabels(
  communityGenres?: CommunityMusicGenres[],
  creatorGenres?: CreatorMusicGenres[],
): string[] {
  if (Array.isArray(communityGenres) && communityGenres.length > 0) {
    return communityGenres.map(
      (genre: CommunityMusicGenres): string => COMMUNITY_MUSIC_GENRE_LABELS[genre],
    );
  }
  if (Array.isArray(creatorGenres) && creatorGenres.length > 0) {
    return creatorGenres.map(
      (genre: CreatorMusicGenres): string => CREATOR_MUSIC_GENRE_LABELS[genre],
    );
  }
  return [];
}

export function mapAccountContentAttributesToLabels(
  communityThemeTopics?: CommunityThemeTopics[],
  creatorContentFocus?: CreatorContentFocus[],
): string[] {
  if (Array.isArray(communityThemeTopics) && communityThemeTopics.length > 0) {
    return communityThemeTopics.map(
      (themeTopic: CommunityThemeTopics): string => COMMUNITY_THEME_TOPIC_LABELS[themeTopic],
    );
  }
  if (Array.isArray(creatorContentFocus) && creatorContentFocus.length > 0) {
    return creatorContentFocus.map(
      (contentFocus: CreatorContentFocus): string => CREATOR_CONTENT_FOCUS_LABELS[contentFocus],
    );
  }
  return [];
}
