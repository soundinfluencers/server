// import {SocialMediaEnum} from './social-media.types';

// export const allowedGenresMap: Record<SocialMediaEnum, readonly string[]> = {
//     [SocialMediaEnum.instagram]: [
//         'Techno (Melodic, Minimal)',
//         'Techno (Hard, Peak)',
//         'House (Tech House)',
//         'House (Melodic, Afro)',
//         'EDM',
//         'D&B',
//         'Bass',
//         'Psy',
//         'Trance',
//         'Dubstep',
//     ],
//     [SocialMediaEnum.tiktok]: [
//         'Techno (Melodic, Minimal)',
//         'Techno (Hard, Peak)',
//         'House (Tech House)',
//         'House (Melodic, Afro)',
//         'EDM',
//         'D&B',
//         'Bass',
//         'Psy',
//         'Trance',
//         'Dubstep',
//     ],
//     [SocialMediaEnum.facebook]: [
//         'Techno (Melodic, Minimal)',
//         'Techno (Hard, Peak)',
//         'House (Tech House)',
//         'House (Melodic, Afro)',
//         'EDM',
//         'D&B',
//         'Bass',
//         'Psy',
//         'Trance',
//         'Dubstep',
//     ],
//     [SocialMediaEnum.youtube]: [
//         'Techno (Melodic, Minimal)',
//         'Techno (Hard, Peak)',
//         'House (Tech House)',
//         'House (Melodic, Afro)',
//         'EDM',
//         'D&B',
//         'Bass',
//         'Psy',
//         'Trance',
//         'Dubstep',
//     ],
//     [SocialMediaEnum.spotify]: [
//         'Techno (Melodic, Minimal)',
//         'Techno (Hard, Peak)',
//         'House (Tech House)',
//         'House (Melodic, Afro)',
//         'EDM',
//         'D&B',
//         'Bass',
//         'Psy',
//         'Trance',
//         'Dubstep',
//         'Garage',
//         'Dance Pop',
//     ],
//     [SocialMediaEnum.soundcloud]: [
//         'Techno (Melodic, Minimal)',
//         'Techno (Hard, Peak)',
//         'House (Tech House)',
//         'House (Melodic, Afro)',
//         'EDM',
//         'D&B',
//         'Bass',
//         'Psy',
//         'Trance',
//         'Dubstep',
//         'Dance Pop',
//     ],
//     [SocialMediaEnum.press]: [
//         'Techno (Melodic, Minimal)',
//         'Techno (Hard, Peak)',
//         'House (Tech House)',
//         'House (Melodic, Afro)',
//         'EDM',
//         'D&B',
//         'Psy',
//         'Trance',
//         'Bass',
//         'Dubstep',
//     ],
// };

// export function isGenreAllowedForSocialMedia(
//     socialMedia: SocialMediaEnum,
//     genre: string,
// ): boolean {
//     const list = allowedGenresMap[socialMedia];
//     return list ? list.includes(genre) : false;
// }

// function collectAllAllowedGenres(): readonly string[] {
//     const set = new Set<string>();
//     for (const list of Object.values(allowedGenresMap)) {
//         for (const g of list) set.add(g);
//     }
//     return [...set].sort();
// }

// export const allAllowedOfferGenres: readonly string[] = collectAllAllowedGenres();
