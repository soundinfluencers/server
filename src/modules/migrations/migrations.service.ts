import {ProfileService} from "../profile/profile.service";
import {PromosService} from "../promos/promos.service";
import {MigrateAccountDto} from "./dto/migrate-account.dto";
import {Connection, Model, Types} from "mongoose";
import {Injectable, Logger} from "@nestjs/common";
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";
import {InjectConnection, InjectModel} from "@nestjs/mongoose";
import {CompletedCampaign} from "../../database/schemas/campaign/completed-campaign.schema";
import {Influencer} from "../../database/schemas/users/influencer.schema";
import {MigrateCompletedCampaignsDto} from "./dto/migrate-completed-campaigns.dto";

type LegacySelectedInfluencer = {
    _id: Types.ObjectId;
    influencerId: Types.ObjectId;
    socialMedia: string;
    socialMediaUsername?: string;
    username?: string;
    accountId?: Types.ObjectId | string;
    confirmation?: string;
    closePromo?: string;
    dateRequest?: string;
    postLink?: string;
    screenshot?: string;
    impressions?: any;
    like?: any;
    comments?: any;
    shares?: any;
    rating?: any;
    adminChecked?: boolean;
    followersNumber?: number;
    followers?: number;
    price?: any;
    publicPrice?: any;
    selectedCampaignContentItem?: string | Types.ObjectId;
};

type LegacyCampaignContentItem = {
    _id: string | Types.ObjectId;
    socialMedia: string;
    videoLink?: string;
    mainLink?: string;
    postDescription?: string;
    descriptions?: any;
    storyTag?: string;
    taggedUser?: string;
    swipeUpLink?: string;
    taggedLink?: string;
    specialWishes?: string;
    additionalBrief?: string;
    socialMediaGroup?: string;
};


// Сервис для разных миграций (к примеру, после обновления схемы либо если нужно перенести соц аккаунт к другому инфлюенсеру)
@Injectable()
export class MigrationsService {
    constructor(
        // connection
        @InjectConnection() private readonly connection: Connection,

        // services
        private readonly profileService: ProfileService,
        private readonly promosService: PromosService,
        private readonly influencersHistoryService: InfluencerActionsHistoryService,

        // models
        @InjectModel(CompletedCampaign.name)
        private readonly completedCampaignModel: Model<CompletedCampaign>,
        @InjectModel(Influencer.name)
        private readonly influencerModel: Model<Influencer>,
    ) {}

    private readonly logger = new Logger();

    // Migrating social account to new owner (with history and updating campaigns)
    async migrateSocialAccountOrchestrator(data: MigrateAccountDto) {
        const session = await this.connection.startSession();
        session.startTransaction();

        try {
            // move social account to new owner
            const context = await this.profileService.moveSocialAccount(data, session);
            this.logger.log(`Moved social account`);

            // move social account's campaigns history to new owner's history
            await this.influencersHistoryService.moveSocialAccountHistory(context, session);
            this.logger.log(`Moved social account's actions history`);

            // replace all old influencerId with new owner's id in ongoing promos
            await this.promosService.replaceInfluencerIdInOngoingPromos(context, session);
            this.logger.log(`Replaced influencerId in promos`);

            await session.commitTransaction();
        } catch (e) {
            await session.abortTransaction();
            throw e;
        } finally {
            await session.endSession();
        }
    }

    private oid(v: any): Types.ObjectId | null {
        if (!v) return null;
        if (v instanceof Types.ObjectId) return v;
        if (typeof v === 'string' && Types.ObjectId.isValid(v)) return new Types.ObjectId(v);
        return null;
    }

    private num(v: any): number | null {
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

    private getInfluencerAccountMap(influencers: any[]): Map<string, Types.ObjectId> {
        const map = new Map<string, Types.ObjectId>();
        const socials = ['instagram', 'tiktok', 'spotify', 'soundcloud', 'facebook', 'youtube', 'press'];

        for (const inf of influencers) {
            const influencerId = String(inf._id);

            for (const social of socials) {
                const arr = Array.isArray(inf[social]) ? inf[social] : [];
                for (const acc of arr) {
                    const accId = this.oid(acc?._id);
                    const username = (acc?.username ?? (acc as any).instagramUsername ?? '').toString(); // БЕЗ нормализации

                    if (!accId || !username) continue;

                    const key = `${influencerId}:${social}:${username}`;
                    if (!map.has(key)) map.set(key, accId);
                }
            }
        }

        return map;
    }

    private socialField(socialMedia: string): string {
        const s = (socialMedia ?? '').toLowerCase();
        if (s === 'ig') return 'instagram';
        return s;
    }

    async migrateCompletedCampaigns(dto: MigrateCompletedCampaignsDto) {
        const limit = dto.limit ?? 100;
        const dryRun = !!dto.dryRun;

        let lastId = this.oid(dto.startAfterId);
        let scanned = 0;
        let updated = 0;
        let missingAccountId = 0;

        while (true) {
            const filter: any = {
                $and: [
                    { selectInfluencers: { $exists: true } },
                    { campaignContent: { $exists: true } },
                    { $or: [{ schemaVersion: { $exists: false } }, { schemaVersion: { $lt: 2 } }] },
                ],
            };
            if (lastId) filter._id = { $gt: lastId };

            const docs = await this.completedCampaignModel.find(filter).sort({ _id: 1 }).limit(limit).lean();
            if (!docs.length) break;

            // 1 запрос на инфлюенсеров батча
            const influencerIds = Array.from(
                new Set(
                    docs
                        .flatMap((d: any) => (Array.isArray(d.selectInfluencers) ? d.selectInfluencers : []))
                        .map((a: any) => this.oid(a?.influencerId))
                        .filter(Boolean)
                        .map((x) => String(x)),
                ),
            ).map((id) => new Types.ObjectId(id));

            const influencers = await this.influencerModel
                .find(
                    { _id: { $in: influencerIds } },
                    {
                        _id: 1,
                        instagram: 1,
                        tiktok: 1,
                        spotify: 1,
                        soundcloud: 1,
                        facebook: 1,
                        youtube: 1,
                        press: 1,
                    },
                )
                .lean();

            const accountMap = this.getInfluencerAccountMap(influencers);

            const bulk: any[] = [];

            for (const doc of docs) {
                scanned++;
                lastId = doc._id as any;

                const legacySelect: LegacySelectedInfluencer[] = (doc as any).selectInfluencers ?? [];
                const legacyContent: LegacyCampaignContentItem[] = (doc as any).campaignContent ?? [];

                const addedAccounts = legacySelect.map((acc) => {
                    const influencerId = this.oid(acc.influencerId);
                    const social = this.socialField(acc.socialMedia);

                    // username в новом документе = socialMediaUsername (или acc.username если есть)
                    const username = (acc.username ?? acc.socialMediaUsername ?? '').toString().trim();

                    // 1) если legacy accountId есть — используем
                    // 2) иначе пытаемся найти по influencerId+social+username
                    let resolvedAccountId = this.oid(acc.accountId);
                    if (!resolvedAccountId && influencerId && username) {
                        const key = `${String(influencerId)}:${social}:${username}`;
                        resolvedAccountId = accountMap.get(key) ?? null;
                    }

                    if (!resolvedAccountId) missingAccountId++;

                    const selectedContentItemId = this.oid(acc.selectedCampaignContentItem);

                    return {
                        _id: this.oid(acc._id) ?? new Types.ObjectId(),
                        influencerId,
                        accountId: resolvedAccountId, // null если не нашли
                        socialMedia: acc.socialMedia,
                        username,

                        price: this.num(acc.price) ?? 0,
                        publicPrice: this.num(acc.publicPrice) ?? 0,
                        followers: (acc as any).followers ?? acc.followersNumber ?? 0,

                        selectedContent: {
                            campaignContentItemId: selectedContentItemId,
                            descriptionId: null,
                        },

                        confirmation: acc.confirmation ?? 'wait',
                        closePromo: acc.closePromo ?? 'wait',

                        dateRequest: acc.dateRequest ?? undefined,
                        postLink: acc.postLink ?? undefined,
                        screenshot: acc.screenshot ?? undefined,

                        impressions: this.num(acc.impressions) ?? undefined,
                        like: this.num(acc.like) ?? undefined,
                        comments: this.num(acc.comments) ?? undefined,
                        shares: this.num(acc.shares) ?? undefined,
                        rating: this.num(acc.rating) ?? undefined,

                        adminChecked: acc.adminChecked ?? false,

                        createdAt: (acc as any).createdAt,
                        updatedAt: (acc as any).updatedAt,
                    };
                });

                const campaignContent = legacyContent.map((c) => {
                    const _id = this.oid(c._id) ?? c._id;
                    const postDescription = (c.postDescription ?? '').toString();

                    return {
                        _id,
                        socialMedia: c.socialMedia,
                        socialMediaGroup: c.socialMediaGroup ?? 'main',
                        mainLink: c.mainLink ?? c.videoLink ?? '',
                        descriptions: postDescription ? [{ _id, description: postDescription }] : [],
                        taggedUser: c.taggedUser ?? c.storyTag,
                        taggedLink: c.taggedLink ?? c.swipeUpLink,
                        additionalBrief: c.additionalBrief ?? c.specialWishes,
                    };
                });

                const updatePipeline = [
                    {
                        $set: {
                            addedAccounts,
                            campaignContent,
                            schemaVersion: 2,
                        },
                    },
                    {
                        $unset: [
                            'selectInfluencers',

                            // legacy поля внутри campaignContent (в старых доках)
                            'campaignContent.videoLink',
                            'campaignContent.postDescription',
                            'campaignContent.storyTag',
                            'campaignContent.swipeUpLink',
                            'campaignContent.specialWishes',

                            // legacy поля внутри selectInfluencers (если вдруг где-то просочились после $set)
                            'addedAccounts.socialMediaUsername',
                            'addedAccounts.followersNumber',
                            'addedAccounts.selectedCampaignContentItem',
                        ],
                    },
                ];

                if (dryRun) {
                    this.logger.log(
                        `[dryRun] ${String(doc._id)} -> addedAccounts=${addedAccounts.length}, content=${campaignContent.length}`,
                    );
                    continue;
                }

                bulk.push({
                    updateOne: {
                        filter: { _id: doc._id },
                        update: updatePipeline,
                    },
                });
            }

            if (!dryRun && bulk.length) {
                const res = await this.completedCampaignModel.collection.bulkWrite(bulk, { ordered: false });
                updated += res.modifiedCount ?? 0;
                this.logger.log(
                    `batch: scanned=${docs.length}, matched=${res.matchedCount}, modified=${res.modifiedCount}`,
                );
            }
        }

        return {
            ok: true,
            dryRun,
            scanned,
            updated,
            missingAccountId,
            note:
                'missingAccountId означает: не удалось найти accountId ни в legacy поле, ни в embedded аккаунтах Influencer (строго по username). В этом случае accountId будет null.',
        };
    }

    private toNumber(v: any): number | null {
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

    // "20€" -> 20, "USD 22" -> 22, "22" -> 22
    private parsePrice(v: any): number | null {
        if (v === null || v === undefined) return null;
        if (typeof v === 'number') return Number.isFinite(v) ? v : null;
        if (typeof v !== 'string') return null;

        const m = v.match(/-?\d+(\.\d+)?/);
        if (!m) return null;
        const n = Number(m[0]);
        return Number.isFinite(n) ? n : null;
    }

    private buildMusicGenres(acc: any) {
        const primary = (acc?.musicStyle ?? '').toString().trim();

        const raw: string[] = []
            .concat(Array.isArray(acc?.musicSubStyles) ? acc.musicSubStyles : [])
            .concat(Array.isArray(acc?.musicStyleOther) ? acc.musicStyleOther : [])
            .map((x: any) => (x ?? '').toString().trim())
            .filter(Boolean);

        // genre -> subGenres[]
        const out: { genre: string; subGenres: string[] }[] = [];

        const ensure = (genre: string) => {
            let g = out.find((x) => x.genre === genre);
            if (!g) {
                g = { genre, subGenres: [] };
                out.push(g);
            }
            return g;
        };

        // 1) основной genre отдельной записью
        if (primary) ensure(primary);

        for (const item of raw) {
            // --- Techno subgenres ---
            if (item === 'Melodic, Minimal' || item === 'Hard, Peak') {
                const g = ensure('Techno');
                if (!g.subGenres.includes(item)) g.subGenres.push(item);
                continue;
            }

            // --- House subgenres ---
            if (item === 'Tech House' || item === 'Melodic' || item === 'Afro House' || item === 'Melodic, Afro') {
                const g = ensure('House');
                if (!g.subGenres.includes(item)) g.subGenres.push(item);
                continue;
            }

            // --- остальные пункты из списка -> отдельные жанры без поджанров ---
            // (Techno/House/EDM/D&B/Bass/Psy, Trance/Dubstep/Pop/Hip-hop и т.д.)
            const g = ensure(item);
            // subGenres не трогаем
        }

        // 2) подчистим пустые/дубликаты (на всякий)
        for (const g of out) {
            g.subGenres = Array.from(new Set(g.subGenres));
        }

        // 3) если primary есть, но не в списке и не встретился — он уже добавлен выше
        return out.length ? out : undefined;
    }

    private mapLegacyAccount(acc: any) {
        const username = (acc?.username ?? acc?.instagramUsername ?? '').toString().trim();
        const profileLink = (acc?.profileLink ?? acc?.instagramLink ?? '').toString().trim();

        const followers =
            this.toNumber(acc?.followers) ??
            this.toNumber(acc?.followersNumber) ??
            0;

        const logoUrl = (acc?.logoUrl ?? acc?.logo ?? '').toString().trim();

        const price = this.parsePrice(acc?.price);
        const publicPrice = this.parsePrice(acc?.publicPrice);

        const mapped: any = {
            ...acc, // сохраняем поля типа countries/categories/engagementRate/...
            username,
            profileLink,
            followers,
            logoUrl,
            price: price ?? 0,
            publicPrice: publicPrice ?? 0,
            musicGenres: this.buildMusicGenres(acc) ?? acc?.musicGenres,
        };

        // выпиливаем legacy поля
        delete mapped.instagramUsername;
        delete mapped.instagramLink;
        delete mapped.followersNumber;
        delete mapped.logo;

        delete mapped.musicStyle;
        delete mapped.musicSubStyles;
        delete mapped.musicStyleOther;

        return mapped;
    }

    async migrateInfluencersSocialAccountsV2(dto: MigrateCompletedCampaignsDto) {
        const limit = dto.limit ?? 200;
        const dryRun = !!dto.dryRun;
        let lastId = this.oid(dto.startAfterId);

        let scanned = 0;
        let updated = 0;

        const socials = ['instagram', 'tiktok', 'spotify', 'soundcloud', 'facebook', 'youtube', 'press'];

        while (true) {
            const filter: any = {
                $or: [{ schemaVersion: { $exists: false } }, { schemaVersion: { $lt: 2 } }],
            };
            if (lastId) filter._id = { $gt: lastId };

            const docs = await this.influencerModel
                .find(filter)
                .sort({ _id: 1 })
                .limit(limit)
                .lean();

            if (!docs.length) break;

            const bulk: any[] = [];

            for (const doc of docs) {
                scanned++;
                lastId = doc._id as any;

                const $set: any = { schemaVersion: 2, updatedAt: new Date() };
                let touched = false;

                for (const social of socials) {
                    const arr = Array.isArray((doc as any)[social]) ? (doc as any)[social] : [];
                    if (!arr.length) continue;

                    $set[social] = arr.map((a: any) => this.mapLegacyAccount(a));
                    touched = true;
                }

                if (!touched) {
                    // даже если не трогали массивы — всё равно можно проставить schemaVersion
                    // но это опционально. Я оставлю: проставляем.
                }

                const updatePipeline = [{ $set }];

                if (dryRun) {
                    this.logger.log(`[dryRun] influencer=${String(doc._id)} touched=${touched}`);
                    continue;
                }

                bulk.push({
                    updateOne: {
                        filter: { _id: doc._id },
                        update: updatePipeline, // pipeline update
                    },
                });
            }

            if (!dryRun && bulk.length) {
                // ВАЖНО: через collection, чтобы не было кастинга mongoose
                const res = await this.influencerModel.collection.bulkWrite(bulk, { ordered: false });
                updated += res.modifiedCount ?? 0;

                this.logger.log(
                    `batch: scanned=${docs.length}, matched=${res.matchedCount}, modified=${res.modifiedCount}`,
                );
            }
        }

        return { ok: true, dryRun, scanned, updated };
    }
}