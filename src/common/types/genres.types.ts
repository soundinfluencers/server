import { SocialMediaEnum } from './social-media.types';

export type InstagramGenresType =
  | 'Techno (Melodic, Minimal)'
  | 'Techno (Hard, Peak)'
  | 'House (Tech House)'
  | 'House (Melodic, Afro)'
  | 'EDM'
  | 'D&B'
  | 'Bass'
  | 'Dubstep';

export type TikTokGenresType =
  | 'Techno (Melodic, Minimal)'
  | 'Techno (Hard, Peak)'
  | 'House (Tech House)'
  | 'House (Melodic, Afro)'
  | 'EDM'
  | 'D&B'
  | 'Bass'
  | 'Psy, Trance'
  | 'Dubstep';

export type FacebookGenresType =
  | 'Techno (Melodic, Minimal)'
  | 'Techno (Hard, Peak)'
  | 'House (Tech House)'
  | 'House (Melodic, Afro)'
  | 'EDM'
  | 'D&B'
  | 'Bass'
  | 'Psy, Trance'
  | 'Dubstep';

export type YouTubeGenresType =
  | 'Techno (Melodic, Minimal)'
  | 'Techno (Hard, Peak)'
  | 'House (Tech House)'
  | 'House (Melodic, Afro)'
  | 'EDM'
  | 'D&B'
  | 'Bass'
  | 'Psy, Trance'
  | 'Dubstep';

export type SpotifyGenresType =
  | 'Techno (Melodic, Minimal)'
  | 'Techno (Hard, Peak)'
  | 'House (Tech House)'
  | 'House (Melodic, Afro)'
  | 'EDM'
  | 'D&B'
  | 'Bass'
  | 'Psy, Trance'
  | 'Dubstep'
  | 'Garage'
  | 'Dance Pop';

export type SoundCloudyGenresType =
  | 'Techno (Melodic, Minimal)'
  | 'Techno (Hard, Peak)'
  | 'House (Tech House)'
  | 'House (Melodic, Afro)'
  | 'EDM'
  | 'D&B'
  | 'Bass'
  | 'Psy, Trance'
  | 'Dubstep'
  | 'Dance Pop';

export type PressGenresType =
  | 'Techno (Melodic, Minimal)'
  | 'Techno (Hard, Peak)'
  | 'House (Tech House)'
  | 'House (Melodic, Afro)'
  | 'EDM'
  | 'D&B'
  | 'Bass'
  | 'Dubstep';

export const allowedGenresMap: Record<SocialMediaEnum, readonly string[]> = {
  [SocialMediaEnum.instagram]: [
    'Techno (Melodic, Minimal)',
    'Techno (Hard, Peak)',
    'House (Tech House)',
    'House (Melodic, Afro)',
    'EDM',
    'D&B',
    'Bass',
    'Dubstep',
  ],
  [SocialMediaEnum.tiktok]: [
    'Techno (Melodic, Minimal)',
    'Techno (Hard, Peak)',
    'House (Tech House)',
    'House (Melodic, Afro)',
    'EDM',
    'D&B',
    'Bass',
    'Psy, Trance',
    'Dubstep',
  ],
  [SocialMediaEnum.facebook]: [
    'Techno (Melodic, Minimal)',
    'Techno (Hard, Peak)',
    'House (Tech House)',
    'House (Melodic, Afro)',
    'EDM',
    'D&B',
    'Bass',
    'Psy, Trance',
    'Dubstep',
  ],
  [SocialMediaEnum.youtube]: [
    'Techno (Melodic, Minimal)',
    'Techno (Hard, Peak)',
    'House (Tech House)',
    'House (Melodic, Afro)',
    'EDM',
    'D&B',
    'Bass',
    'Psy, Trance',
    'Dubstep',
  ],
  [SocialMediaEnum.spotify]: [
    'Techno (Melodic, Minimal)',
    'Techno (Hard, Peak)',
    'House (Tech House)',
    'House (Melodic, Afro)',
    'EDM',
    'D&B',
    'Bass',
    'Psy, Trance',
    'Dubstep',
    'Garage',
    'Dance Pop',
  ],
  [SocialMediaEnum.soundcloud]: [
    'Techno (Melodic, Minimal)',
    'Techno (Hard, Peak)',
    'House (Tech House)',
    'House (Melodic, Afro)',
    'EDM',
    'D&B',
    'Bass',
    'Psy, Trance',
    'Dubstep',
    'Dance Pop',
  ],
  [SocialMediaEnum.press]: [
    'Techno (Melodic, Minimal)',
    'Techno (Hard, Peak)',
    'House (Tech House)',
    'House (Melodic, Afro)',
    'EDM',
    'D&B',
    'Bass',
    'Dubstep',
  ],
};
