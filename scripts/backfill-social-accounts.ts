import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import mongoose, { Connection } from 'mongoose';

import { AppModule } from '../src/modules/app/app.module';
import { SocialMediaEnum } from 'src/common/types/social-media.types';
import {
  CommunityMusicGenres,
  CommunityThemeTopics,
  CreatorContentFocus,
  CreatorMusicGenres,
  InfluencerProfileCategory,
} from 'src/common/types/influencer/influencer.types';

type LegacyMusicGenres = {
  genre?: string;
  subGenres?: string[];
};

type LegacySocialAccount = {
  _id?: unknown;
  profileCategory?: InfluencerProfileCategory;

  // legacy fields
  musicGenres?: LegacyMusicGenres[];
  categories?: string[];
  creatorCategories?: string[];

  // new fields
  communityMusicGenres?: CommunityMusicGenres[];
  communityThemeTopics?: CommunityThemeTopics[];
  creatorMusicGenres?: CreatorMusicGenres[];
  creatorContentFocus?: CreatorContentFocus[];

  [key: string]: unknown;
};

type LegacyInfluencerDocument = {
  _id: unknown;
  [key: string]: unknown;
};

type UnknownValues = {
  musicGenres: Set<string>;
  communityThemeTopics: Set<string>;
  creatorContentFocus: Set<string>;
};

const APPLY_MIGRATION = true;

function normalizeLegacyKey(value: string): string {
  const raw = value
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[()]/g, ' ')
    .trim();

  const aliases: Record<string, string> = {
    'd&b': 'drum_and_bass',
    dnb: 'drum_and_bass',
    'hip-hop': 'hip_hop',
    reaction: 'reactions',
    fitness: 'fitness_sport',
  };

  if (aliases[raw]) {
    return aliases[raw];
  }

  return raw
    .replace(/&/g, 'and')
    .replace(/[,/]/g, ' ')
    .replace(/-/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

const LEGACY_COMMUNITY_MUSIC_GENRE_MAP: Record<string, CommunityMusicGenres[]> = {
  techno: [CommunityMusicGenres.TECHNO_MELODIC_MINIMAL, CommunityMusicGenres.TECHNO_HARD_PEAK],
  techno_melodic_minimal: [CommunityMusicGenres.TECHNO_MELODIC_MINIMAL],
  techno_hard_peak: [CommunityMusicGenres.TECHNO_HARD_PEAK],

  house: [CommunityMusicGenres.HOUSE_TECH_HOUSE, CommunityMusicGenres.HOUSE_MELODIC_AFRO],
  house_tech_house: [CommunityMusicGenres.HOUSE_TECH_HOUSE],
  house_melodic_afro: [CommunityMusicGenres.HOUSE_MELODIC_AFRO],

  edm: [CommunityMusicGenres.EDM],
  drum_and_bass: [CommunityMusicGenres.DRUM_AND_BASS],
  bass: [CommunityMusicGenres.BASS],
  psy_trance: [CommunityMusicGenres.PSY_TRANCE],
  psy: [CommunityMusicGenres.PSY_TRANCE],
  trance: [CommunityMusicGenres.PSY_TRANCE],
  dubstep: [CommunityMusicGenres.DUBSTEP],
  hip_hop: [CommunityMusicGenres.HIP_HOP],
  pop: [CommunityMusicGenres.POP],

  house_melodic: [CommunityMusicGenres.HOUSE_MELODIC_AFRO],
  house_afro_house: [CommunityMusicGenres.HOUSE_MELODIC_AFRO],
};

const LEGACY_CREATOR_MUSIC_GENRE_MAP: Record<string, CreatorMusicGenres[]> = {
  techno: [
    CreatorMusicGenres.ELECTRONIC_TECHNO_MELODIC_MINIMAL,
    CreatorMusicGenres.ELECTRONIC_TECHNO_HARD_PEAK,
  ],
  techno_melodic_minimal: [CreatorMusicGenres.ELECTRONIC_TECHNO_MELODIC_MINIMAL],
  techno_hard_peak: [CreatorMusicGenres.ELECTRONIC_TECHNO_HARD_PEAK],

  house: [
    CreatorMusicGenres.ELECTRONIC_HOUSE_TECH_HOUSE,
    CreatorMusicGenres.ELECTRONIC_HOUSE_MELODIC_AFRO,
  ],
  house_tech_house: [CreatorMusicGenres.ELECTRONIC_HOUSE_TECH_HOUSE],
  house_melodic_afro: [CreatorMusicGenres.ELECTRONIC_HOUSE_MELODIC_AFRO],

  edm: [CreatorMusicGenres.ELECTRONIC_EDM],
  drum_and_bass: [CreatorMusicGenres.ELECTRONIC_DRUM_AND_BASS],
  bass: [CreatorMusicGenres.ELECTRONIC_BASS],
  psy_trance: [CreatorMusicGenres.ELECTRONIC_PSY_TRANCE],
  psy: [CreatorMusicGenres.ELECTRONIC_PSY_TRANCE],
  trance: [CreatorMusicGenres.ELECTRONIC_PSY_TRANCE],
  dubstep: [CreatorMusicGenres.ELECTRONIC_DUBSTEP],

  pop: [CreatorMusicGenres.MAINSTREAM_POP],
  hip_hop: [CreatorMusicGenres.MAINSTREAM_HIP_HOP],
  arabic: [CreatorMusicGenres.MAINSTREAM_ARABIC],
  k_pop: [CreatorMusicGenres.MAINSTREAM_K_POP],
  metal_rock: [CreatorMusicGenres.MAINSTREAM_METAL_ROCK],
  latin: [CreatorMusicGenres.MAINSTREAM_LATIN],

  house_melodic: [CreatorMusicGenres.ELECTRONIC_HOUSE_MELODIC_AFRO],
  house_afro_house: [CreatorMusicGenres.ELECTRONIC_HOUSE_MELODIC_AFRO],
};

const LEGACY_COMMUNITY_THEME_TOPIC_MAP: Record<string, CommunityThemeTopics> = {
  ibiza: CommunityThemeTopics.IBIZA,
  dancing: CommunityThemeTopics.DANCING,
  meme: CommunityThemeTopics.MEME,
};

const LEGACY_CREATOR_CONTENT_FOCUS_MAP: Record<string, CreatorContentFocus> = {
  dance: CreatorContentFocus.MUSIC_DANCE,
  lipsync: CreatorContentFocus.MUSIC_LIPSYNC,
  reactions: CreatorContentFocus.MUSIC_REACTIONS,
  reaction: CreatorContentFocus.MUSIC_REACTIONS,
  lyrics: CreatorContentFocus.MUSIC_LYRICS,

  lifestyle: CreatorContentFocus.ENTERTAINMENT_LIFESTYLE,
  fashion: CreatorContentFocus.ENTERTAINMENT_FASHION,
  fitness_sport: CreatorContentFocus.ENTERTAINMENT_FITNESS_SPORT,
  fitness: CreatorContentFocus.ENTERTAINMENT_FITNESS_SPORT,
  beauty: CreatorContentFocus.ENTERTAINMENT_BEAUTY,
  travel: CreatorContentFocus.ENTERTAINMENT_TRAVEL,
  family: CreatorContentFocus.ENTERTAINMENT_FAMILY,
  comedy: CreatorContentFocus.ENTERTAINMENT_COMEDY,
  cosplay: CreatorContentFocus.ENTERTAINMENT_COSPLAY,
  food: CreatorContentFocus.ENTERTAINMENT_FOOD,
  art: CreatorContentFocus.ENTERTAINMENT_ART,
};

const IGNORED_LEGACY_MUSIC_GENRE_KEYS = new Set([
  'ibiza',
  'dancing',
  'meme',
  'dance',
  'music',

  // unsupported by current enum
  'garage',
  'dance_pop',
  'afro',
  'minimal',
]);

const IGNORED_LEGACY_CREATOR_CONTENT_FOCUS_KEYS = new Set(['music', 'singer', 'dj']);

function normalizeLegacyMusicGenres<T extends string>(
  musicGenres: LegacyMusicGenres[] | undefined,
  map: Record<string, T[]>,
  unknownValues: Set<string>,
  ignoredValues: Set<string>,
): T[] {
  const result = new Set<T>();

  for (const musicGenre of musicGenres ?? []) {
    if (!musicGenre.genre) {
      continue;
    }

    const parentKey = normalizeLegacyKey(musicGenre.genre);
    const subGenres = musicGenre.subGenres ?? [];

    const keys =
      subGenres.length > 0
        ? subGenres.map((subGenre) => {
            const subGenreKey = normalizeLegacyKey(subGenre);
            return `${parentKey}_${subGenreKey}`;
          })
        : [parentKey];

    for (const key of keys) {
      const normalizedValues = map[key];

      if (normalizedValues?.length) {
        for (const normalizedValue of normalizedValues) {
          result.add(normalizedValue);
        }

        continue;
      }

      if (!ignoredValues.has(key)) {
        unknownValues.add(key);
      }
    }
  }

  return [...result];
}

function normalizeLegacyStringArray<T extends string>(
  values: string[] | undefined,
  map: Record<string, T>,
  unknownValues: Set<string>,
  ignoredValues = new Set<string>(),
): T[] {
  const result = new Set<T>();

  for (const value of values ?? []) {
    if (typeof value !== 'string') {
      continue;
    }

    const key = normalizeLegacyKey(value);
    const normalized = map[key];

    if (normalized) {
      result.add(normalized);
      continue;
    }

    if (!ignoredValues.has(key)) {
      unknownValues.add(key);
    }
  }

  return [...result];
}

function migrateSocialAccount(
  account: LegacySocialAccount,
  unknownValues: UnknownValues,
): {
  account: LegacySocialAccount;
  changed: boolean;
} {
  const migratedAccount: LegacySocialAccount = {
    ...account,
  };

  let changed = false;

  const profileCategory = migratedAccount.profileCategory ?? InfluencerProfileCategory.community;

  const isCreator = profileCategory === InfluencerProfileCategory.creator;

  if (Array.isArray(migratedAccount.musicGenres)) {
    if (isCreator) {
      const creatorMusicGenres = normalizeLegacyMusicGenres(
        migratedAccount.musicGenres,
        LEGACY_CREATOR_MUSIC_GENRE_MAP,
        unknownValues.musicGenres,
        IGNORED_LEGACY_MUSIC_GENRE_KEYS,
      );

      migratedAccount.creatorMusicGenres = creatorMusicGenres;
      delete migratedAccount.communityMusicGenres;
    } else {
      const communityMusicGenres = normalizeLegacyMusicGenres(
        migratedAccount.musicGenres,
        LEGACY_COMMUNITY_MUSIC_GENRE_MAP,
        unknownValues.musicGenres,
        IGNORED_LEGACY_MUSIC_GENRE_KEYS,
      );

      migratedAccount.communityMusicGenres = communityMusicGenres;
      delete migratedAccount.creatorMusicGenres;
    }

    delete migratedAccount.musicGenres;
    changed = true;
  }

  if (isCreator && Array.isArray(migratedAccount.creatorCategories)) {
    migratedAccount.creatorContentFocus = normalizeLegacyStringArray(
      migratedAccount.creatorCategories,
      LEGACY_CREATOR_CONTENT_FOCUS_MAP,
      unknownValues.creatorContentFocus,
      IGNORED_LEGACY_CREATOR_CONTENT_FOCUS_KEYS,
    );

    delete migratedAccount.creatorCategories;
    delete migratedAccount.categories;
    delete migratedAccount.communityThemeTopics;
    changed = true;
  }

  if (!isCreator && Array.isArray(migratedAccount.categories)) {
    migratedAccount.communityThemeTopics = normalizeLegacyStringArray(
      migratedAccount.categories,
      LEGACY_COMMUNITY_THEME_TOPIC_MAP,
      unknownValues.communityThemeTopics,
    );

    delete migratedAccount.categories;
    delete migratedAccount.creatorCategories;
    delete migratedAccount.creatorContentFocus;
    changed = true;
  }

  // На случай если legacy-поля есть, но они не массивы.
  if ('musicGenres' in migratedAccount) {
    delete migratedAccount.musicGenres;
    changed = true;
  }

  if ('categories' in migratedAccount) {
    delete migratedAccount.categories;
    changed = true;
  }

  if ('creatorCategories' in migratedAccount) {
    delete migratedAccount.creatorCategories;
    changed = true;
  }

  return {
    account: migratedAccount,
    changed,
  };
}

function assertNoUnknownValues(unknownValues: UnknownValues): void {
  const unknownMusicGenres = [...unknownValues.musicGenres];
  const unknownCommunityThemeTopics = [...unknownValues.communityThemeTopics];
  const unknownCreatorContentFocus = [...unknownValues.creatorContentFocus];

  if (
    unknownMusicGenres.length === 0 &&
    unknownCommunityThemeTopics.length === 0 &&
    unknownCreatorContentFocus.length === 0
  ) {
    return;
  }

  throw new Error(
    [
      'Migration stopped because unknown legacy values were found.',
      '',
      `Unknown music genres: ${unknownMusicGenres.join(', ') || '-'}`,
      `Unknown community theme topics: ${unknownCommunityThemeTopics.join(', ') || '-'}`,
      `Unknown creator content focus: ${unknownCreatorContentFocus.join(', ') || '-'}`,
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const mongoUri = process.env.DATABASE_ROOT;

  if (!mongoUri) {
    throw new Error('Mongo connection string not found in env');
  }

  await mongoose.connect(mongoUri);

  try {
    const influencerCollection =
      mongoose.connection.collection<LegacyInfluencerDocument>('influencers');

    const unknownValues: UnknownValues = {
      musicGenres: new Set<string>(),
      communityThemeTopics: new Set<string>(),
      creatorContentFocus: new Set<string>(),
    };

    let scannedInfluencers = 0;
    let updatedInfluencers = 0;
    let updatedAccounts = 0;

    const influencers = await influencerCollection.find({}).toArray();

    if (influencers.length === 0) {
      throw new Error('Influencers not found');
    }

    const socialMedias = Object.values(SocialMediaEnum);

    const pendingUpdates: Array<{
      influencerId: unknown;
      update: Record<string, LegacySocialAccount[]>;
    }> = [];

    for (const influencer of influencers) {
      scannedInfluencers++;

      const update: Record<string, LegacySocialAccount[]> = {};
      let influencerChangedAccounts = 0;

      for (const socialMedia of socialMedias) {
        const rawAccounts = influencer[socialMedia];

        if (!Array.isArray(rawAccounts) || rawAccounts.length === 0) {
          continue;
        }

        const socialMediaAccounts = rawAccounts as LegacySocialAccount[];
        let socialMediaChanged = false;

        const migratedAccounts = socialMediaAccounts.map((account) => {
          const result = migrateSocialAccount(account, unknownValues);

          if (result.changed) {
            socialMediaChanged = true;
            influencerChangedAccounts++;
          }

          return result.account;
        });

        if (socialMediaChanged) {
          update[socialMedia] = migratedAccounts;
        }
      }

      if (Object.keys(update).length === 0) {
        continue;
      }

      updatedInfluencers++;
      updatedAccounts += influencerChangedAccounts;

      pendingUpdates.push({
        influencerId: influencer._id,
        update,
      });
    }

    assertNoUnknownValues(unknownValues);

    if (APPLY_MIGRATION) {
      for (const pendingUpdate of pendingUpdates) {
        await influencerCollection.updateOne(
          { _id: pendingUpdate.influencerId },
          { $set: pendingUpdate.update },
        );
      }

      console.log('Migration completed.');
    } else {
      console.log('Dry run completed. No changes were saved.');
      console.log('Run with APPLY_MIGRATION=true to save changes.');
    }

    console.log({
      scannedInfluencers,
      updatedInfluencers,
      updatedAccounts,
    });
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
