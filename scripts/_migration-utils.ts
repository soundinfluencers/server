import mongoose, {Types} from 'mongoose';
import {CampaignConfirmationEnum, CampaignStatusEnum} from '../src/common/types/client/campaign.types';
import {AccountVerifiedStatus} from '../src/common/types/user.types';
import {SocialAccountLabelStatus} from '../src/common/types/influencer/influencer.types';

export const SOCIAL_FIELDS = ['instagram', 'tiktok', 'spotify', 'soundcloud', 'facebook', 'youtube', 'press'] as const;

export type LegacyCampaignStatus = 'wait' | 'work' | 'finally' | string;
export type LegacyCampaignVerify = 'wait' | 'accept' | 'decline' | string;

export type LegacySelectedInfluencer = {
    _id: Types.ObjectId;
    influencerId: Types.ObjectId;
    socialMedia: string;
    socialMediaUsername?: string;
    username?: string;
    accountId?: Types.ObjectId | string;
    confirmation?: string;
    closePromo?: string;
    dateRequest?: string;
    datePost?: string;
    postLink?: string;
    screenshot?: string;
    impressions?: unknown;
    like?: unknown;
    comments?: unknown;
    shares?: unknown;
    saves?: unknown;
    rating?: unknown;
    adminChecked?: boolean;
    followersNumber?: number;
    followers?: number;
    price?: unknown;
    publicPrice?: unknown;
    genres?: string[];
    countries?: object[];
    selectedCampaignContentItem?: string | Types.ObjectId;
    selectedContent?: string | Types.ObjectId | {
        campaignContentItemId: string | Types.ObjectId;
        postDescriptionId: string | Types.ObjectId;
    };
};

export type LegacyCampaignContentItem = {
    _id: string | Types.ObjectId;
    socialMedia: string;
    videoLink?: string;
    mainLink?: string;
    postDescription?: string;
    postDescriptions?: {
        _id: string | Types.ObjectId;
        description: string;
    }[];
    storyTag?: string;
    taggedUser?: string;
    swipeUpLink?: string;
    taggedLink?: string;
    specialWishes?: string;
    additionalBrief?: string;
    socialMediaGroup?: string;
};

export function oid(v: unknown): Types.ObjectId | null {
    if (!v) return null;
    if (v instanceof Types.ObjectId) return v;
    if (typeof v === 'string' && Types.ObjectId.isValid(v)) return new Types.ObjectId(v);
    return null;
}

export function num(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string') {
        const s = v.trim();
        if (!s) return null;
        const digitsOnly = s.replace(/\D+/g, '');
        if (!digitsOnly) return null;
        const n = Number(digitsOnly);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

export function toNumber(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string') {
        const s = v.trim();
        if (!s) return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

export function parsePrice(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v !== 'string') return null;
    const m = v.match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
}

export function socialField(socialMedia: string): string {
    const s = (socialMedia ?? '').toLowerCase();
    return s === 'ig' ? 'instagram' : s;
}

export function getArg(name: string): string | undefined {
    const prefix = `--${name}=`;
    const direct = process.argv.find((a) => a.startsWith(prefix));
    if (direct) return direct.slice(prefix.length);

    const idx = process.argv.indexOf(`--${name}`);
    if (idx !== -1 && idx + 1 < process.argv.length && !process.argv[idx + 1].startsWith('--')) {
        return process.argv[idx + 1];
    }

    return undefined;
}

export function getIntArg(name: string, defaultValue: number): number {
    const raw = getArg(name);
    if (raw === undefined) return defaultValue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) {
        throw new Error(`Argument --${name} must be a positive number, got "${raw}"`);
    }
    return Math.trunc(n);
}

export function getFlag(name: string): boolean {
    if (process.argv.includes(`--${name}`)) return true;
    const raw = getArg(name);
    return raw === 'true' || raw === '1';
}

export function getDbUri(): string {
    const uri = process.env.DATABASE_ROOT;
    if (!uri) {
        throw new Error('DATABASE_ROOT is not set');
    }
    return uri;
}

export async function connectMongo(): Promise<mongoose.Connection> {
    await mongoose.connect(getDbUri());
    const connection = mongoose.connection;
    if (!connection.db) {
        throw new Error('Mongo connection has no db instance');
    }
    return connection;
}

export async function disconnectMongo(): Promise<void> {
    await mongoose.disconnect();
}

export function getInfluencerAccountMap(influencers: any[]): Map<string, Types.ObjectId> {
    const map = new Map<string, Types.ObjectId>();

    for (const inf of influencers) {
        const influencerId = String(inf._id);

        for (const social of SOCIAL_FIELDS) {
            const arr = Array.isArray(inf[social]) ? inf[social] : [];
            for (const acc of arr) {
                const accId = oid(acc?._id);
                const username = (acc?.username ?? acc?.instagramUsername ?? '').toString();

                if (!accId || !username) continue;

                const key = `${influencerId}:${social}:${username}`;
                if (!map.has(key)) map.set(key, accId);
            }
        }
    }

    return map;
}

export function buildMusicGenres(acc: any): { genre: string; subGenres: string[] }[] | undefined {
    const primary = (acc?.musicStyle ?? '').toString().trim();
    const raw: string[] = []
        .concat(Array.isArray(acc?.musicSubStyles) ? acc.musicSubStyles : [])
        .concat(Array.isArray(acc?.musicStyleOther) ? acc.musicStyleOther : [])
        .map((x: unknown) => (x ?? '').toString().trim())
        .filter(Boolean);

    const out: { genre: string; subGenres: string[] }[] = [];

    const ensure = (genre: string) => {
        let g = out.find((x) => x.genre === genre);
        if (!g) {
            g = {genre, subGenres: []};
            out.push(g);
        }
        return g;
    };

    if (primary) ensure(primary);

    for (const item of raw) {
        if (item === 'Melodic, Minimal' || item === 'Hard, Peak') {
            const g = ensure('Techno');
            if (!g.subGenres.includes(item)) g.subGenres.push(item);
            continue;
        }

        if (item === 'Tech House' || item === 'Melodic' || item === 'Afro House' || item === 'Melodic, Afro') {
            const g = ensure('House');
            if (!g.subGenres.includes(item)) g.subGenres.push(item);
            continue;
        }

        ensure(item);
    }

    for (const g of out) {
        g.subGenres = Array.from(new Set(g.subGenres));
    }

    return out.length ? out : undefined;
}

export function mapLegacyAccount(acc: any) {
    const username = (acc?.username ?? acc?.instagramUsername ?? '').toString().trim();
    const profileLink = (acc?.profileLink ?? acc?.instagramLink ?? '').toString().trim();
    const followers = toNumber(acc?.followers) ?? toNumber(acc?.followersNumber) ?? 0;
    const logoUrl = (acc?.logoUrl ?? acc?.logo ?? '').toString().trim();
    const price = parsePrice(acc?.price);
    const publicPrice = parsePrice(acc?.publicPrice);
    const initialPrice = parsePrice(acc?.initialPrice) ?? price;

    const mapped: any = {
        ...acc,
        username,
        profileLink,
        followers,
        logoUrl,
        price: price ?? 0,
        publicPrice: publicPrice ?? 0,
        initialPrice: initialPrice ?? 0,
        musicGenres: buildMusicGenres(acc) ?? acc?.musicGenres,
        verifiedStatus: acc.isVerified === true ? AccountVerifiedStatus.accept : AccountVerifiedStatus.waitForAdmin,
        labelStatus: acc.isVerified === true ? SocialAccountLabelStatus.accept : SocialAccountLabelStatus.waitForAdmin,
    };

    if (typeof mapped._id === 'string') {
        mapped._id = new Types.ObjectId(acc._id);
    }

    delete mapped.instagramUsername;
    delete mapped.instagramLink;
    delete mapped.followersNumber;
    delete mapped.logo;
    delete mapped.musicStyle;
    delete mapped.musicSubStyles;
    delete mapped.musicStyleOther;

    return mapped;
}

export function getLegacyCampaignFields(doc: any): {
    legacyStatus: LegacyCampaignStatus | undefined;
    legacyVerify: LegacyCampaignVerify | undefined;
} {
    const legacyStatus = (doc?.statusCampaign ?? doc?.statusPromo) as LegacyCampaignStatus | undefined;
    const legacyVerify = (doc?.verifyCampaign ?? doc?.verifyPromo) as LegacyCampaignVerify | undefined;
    return {legacyStatus, legacyVerify};
}

export function mapCampaignStatus(
    legacyStatus: LegacyCampaignStatus | undefined,
    legacyVerify: LegacyCampaignVerify | undefined,
): CampaignStatusEnum {
    const s = (legacyStatus ?? 'wait').toString();
    const v = (legacyVerify ?? 'wait').toString();

    if (v === 'decline') return CampaignStatusEnum.underReview;
    if (s === 'wait' && v === 'wait') return CampaignStatusEnum.underReview;
    if (s === 'wait' && v === 'accept') return CampaignStatusEnum.pending;
    if (s === 'work' && v === 'accept') return CampaignStatusEnum.distributing;
    if (s === 'finally' && v === 'accept') return CampaignStatusEnum.completed;

    return CampaignStatusEnum.underReview;
}

export function mapCampaignVerify(
    legacyVerify: LegacyCampaignVerify | undefined,
): CampaignConfirmationEnum {
    const v = (legacyVerify ?? 'wait').toString().toLowerCase();

    if (['accept', 'accepted', 'true', '1', 'ok', 'approved'].includes(v)) {
        return CampaignConfirmationEnum.accept;
    }

    if (
        ['decline', 'declined', 'reject', 'rejected', 'denied', 'cancel', 'canceled', 'cancelled', 'false', '0']
            .includes(v)
    ) {
        return CampaignConfirmationEnum.decline;
    }

    return CampaignConfirmationEnum.wait;
}
