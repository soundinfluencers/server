export type SocialMediaType =
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'youtube'
  | 'spotify'
  | 'soundcloud'
  | 'press';

export enum SocialMediaEnum {
  instagram = 'instagram',
  tiktok = 'tiktok',
  facebook = 'facebook',
  youtube = 'youtube',
  spotify = 'spotify',
  soundcloud = 'soundcloud',
  press = 'press'
}

// Social media labels for UI
export const socialMediaLabels: Record<SocialMediaType, string> = {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    facebook: 'Facebook',
    youtube: 'YouTube',
    spotify: 'Spotify',
    soundcloud: 'SoundCloud',
    press: 'Press',
};
