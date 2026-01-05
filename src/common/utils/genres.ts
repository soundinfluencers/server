import {InfluencerMusicGenre} from "../../database/schemas/users/influencer.schema";

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
export const normalizeMusicGenres = (musicGenres: string[]): InfluencerMusicGenre[] => {
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
