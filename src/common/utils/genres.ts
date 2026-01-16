import {InfluencerMusicGenre} from "../../database/schemas/users/influencer.schema";
import {MusicGenreDto} from "../../modules/auth/dto/create-influencer.dto";

export const returnMusicStyles = (musicStyle: string, musicStyleOther: string[], musicSubStyles: string[]) => {
    const genresSet = new Set();

    if (musicStyle !== undefined && musicStyle) {
        if (musicSubStyles && musicSubStyles.length > 0) {
            for (let i = 0; i < musicSubStyles.length; i++) {
                if (musicSubStyles[i] === 'Melodic, Minimal') {
                    genresSet.add('Techno (Melodic, Minimal)');
                }
                if (musicSubStyles[i] === 'Hard, Peak') {
                    genresSet.add('Techno (Hard, Peak)');
                }
                if (musicSubStyles[i] === 'Tech House') {
                    genresSet.add('House (Tech House)');
                }
                if (musicSubStyles[i] === 'Melodic, Afro') {
                    genresSet.add('House (Melodic, Afro)');
                }
            }
        } else {
            genresSet.add(musicStyle);
        }

        if (musicStyleOther && musicStyleOther.length > 0) {
            for (let i = 0; i < musicStyleOther.length; i++) {
                if (musicStyleOther[i] !== 'House') {
                    genresSet.add(musicStyleOther[i]);
                }
            }
        }

        return Array.from(genresSet);
    }
};

// Parses InfluencerMusicGenre[] to string[]
export const getArrayFromAccountMusicGenres = (musicGenres: InfluencerMusicGenre[]): string[] => {
    return musicGenres.flatMap(g =>
        g.subGenres.length > 0
            ? g.subGenres.map(sub => `${g.genre} ${sub}`)
            : [g.genre]
    );
};

// Parses string[] to InfluencerMusicGenre[]
export const normalizeStringToMusicGenres = (musicGenres: string[]): InfluencerMusicGenre[] => {
    return musicGenres.map((item) => {
        const match = item.match(/^(.+?)\s*\((.+)\)$/);

        if (match) {
            const genre = match[1].trim();
            const subGenres = match[2]
                .split(',')
                .map(s => s.trim());

            return {
                genre,
                subGenres,
            };
        }

        return {
            genre: item.trim(),
            subGenres: [],
        };
    });
};

// Parses MusicGenreDto[] to InfluencerMusicGenre[]
export const normalizeDtoToMusicGenres = (
    musicGenres: MusicGenreDto[] = []
): InfluencerMusicGenre[] => {
    const formatGenreName = (value: string): string => {
        return value
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    return musicGenres.map(genreDto => ({
        genre: formatGenreName(genreDto.genre),
        subGenres: (genreDto.subGenres ?? []).map(sub =>
            formatGenreName(sub)
        ),
    }));
};

// Parses MusicGenreDto[] to string[]
export const getArrayFromMusicGenreDto = (
    musicGenres: MusicGenreDto[] = []
): string[] => {
    const formatGenreName = (value: string): string =>
        value
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');

    const result: string[] = [];

    for (const genreDto of musicGenres) {
        const mainGenre = formatGenreName(genreDto.genre);

        if (!genreDto.subGenres || genreDto.subGenres.length === 0) {
            result.push(mainGenre);
            continue;
        }

        for (const sub of genreDto.subGenres) {
            const subGenre = formatGenreName(sub);
            result.push(`${mainGenre} ${subGenre}`);
        }
    }

    return result;
};