import {ProfileService} from "../profile/profile.service";
import {PromosService} from "../promos/promos.service";
import {MigrateAccountDto} from "./dto/migrate-account.dto";
import {Connection, Model, Types} from "mongoose";
import {Injectable, Logger} from "@nestjs/common";
import {InfluencerActionsHistoryService} from "../influencer-actions-history/influencer-actions-history.service";
import {InjectConnection, InjectModel} from "@nestjs/mongoose";
import {Influencer} from "../../database/schemas/users/influencer.schema";
import {MigrateCampaignsDto} from "./dto/migrate-campaigns.dto";
import {Campaign, CampaignAccount, CampaignContentItem} from "../../database/schemas/campaign/campaign.schema";
import {SocialMediaEnum} from "../../common/types/social-media.types";
import {
    InfluencerConfirmationStatusEnum,
    InfluencerPromoClosedStatusEnum,
    InfluencerPromoClosedStatusType
} from "../../common/types/influencer/promo.types";
import {CampaignConfirmationEnum, CampaignStatusEnum} from "../../common/types/client/campaign.types";


// ------------ LEGACY SCHEMAS ---------------
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
    saves?: any;
    rating?: any;
    adminChecked?: boolean;
    followersNumber?: number;
    followers?: number;
    price?: any;
    publicPrice?: any;
    selectedContent?: string | Types.ObjectId | {
        campaignContentItemId: string | Types.ObjectId;
        postDescriptionId: string | Types.ObjectId;
    };
};

type LegacyCampaignContentItem = {
    _id: string | Types.ObjectId;
    socialMedia: string;
    videoLink?: string;
    mainLink?: string;
    postDescription?: string;
    postDescriptions?: {
        _id: string | Types.ObjectId;
        description: string;
    };
    storyTag?: string;
    taggedUser?: string;
    swipeUpLink?: string;
    taggedLink?: string;
    specialWishes?: string;
    additionalBrief?: string;
    socialMediaGroup?: string;
};

type LegacyCampaignStatus = 'wait' | 'work' | 'finally' | string;

type LegacyCampaignVerify = 'wait' | 'accept' | 'decline' | string;


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

        // for migrating completed campaigns
        // @InjectModel(CompletedCampaign.name)
        // private readonly campaignModel: Model<CompletedCampaign>,

        // for migrating completed campaigns
        @InjectModel(Campaign.name)
        private readonly campaignModel: Model<Campaign>,
        @InjectModel(Influencer.name)
        private readonly influencerModel: Model<Influencer>,
    ) {
    }

    private readonly logger = new Logger();

    // ------------- UTILS ----------------


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


    // ------------- HELPERS ----------------


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
                g = {genre, subGenres: []};
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

    // for getting legacy statuses
    private getLegacyCampaignFields(doc: any): {
        legacyStatus: LegacyCampaignStatus | undefined;
        legacyVerify: LegacyCampaignVerify | undefined;
    } {
        const legacyStatus =
            (doc?.statusCampaign ?? doc?.statusPromo) as LegacyCampaignStatus | undefined;

        const legacyVerify =
            (doc?.verifyCampaign ?? doc?.verifyPromo) as LegacyCampaignVerify | undefined;

        return {legacyStatus, legacyVerify};
    }

    // Mapper: (legacy status + legacy verify) -> CampaignStatusEnum
    private mapCampaignStatus(
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

        // fallback
        return CampaignStatusEnum.underReview;
    }

    // Mapper: legacy verify -> CampaignConfirmationEnum
    private mapCampaignVerify(
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

        // fallback
        return CampaignConfirmationEnum.wait;
    }


    // ------------- SERVICES ----------------


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


    // Migrating campaigns after updating schema
    async migrateCampaigns(dto: MigrateCampaignsDto) {
        const limit = dto.limit ?? 100;
        const dryRun = !!dto.dryRun;

        let lastId = this.oid(dto.startAfterId);
        let scanned = 0;
        let updated = 0;
        let missingAccountId = 0;

        while (true) {
            const filter: any = {
                $and: [
                    {selectInfluencers: {$exists: true}},
                    {campaignContent: {$exists: true}},
                    {$or: [{schemaVersion: {$exists: false}}, {schemaVersion: {$lt: 2}}]},
                ],
            };
            if (lastId) filter._id = {$gt: lastId};

            const docs = await this.campaignModel.find(filter).sort({_id: 1}).limit(limit).lean();
            if (!docs.length) break;

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
                    {_id: {$in: influencerIds}},
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

                // proceeding campaign content array
                const campaignContent = legacyContent.map((c) => {
                    // update descriptions array (was postDescriptions[] or even postDescription string field)
                    const descriptions: { _id: Types.ObjectId; description: string }[] =
                        Array.isArray(c.postDescriptions) && c.postDescriptions.length > 0
                            ? c.postDescriptions.map((p) => ({
                                _id: p._id instanceof Types.ObjectId
                                    ? p._id
                                    : new Types.ObjectId(p._id),
                                description: p.description,
                            }))
                            : [
                                {
                                    _id: new Types.ObjectId(),
                                    description: c.postDescription,
                                },
                            ];

                    // NOTE: if there wasn't postDescriptions array, new descriptions array will contain only one item

                    return {
                        _id: this.oid(c._id),
                        socialMedia: c.socialMedia as SocialMediaEnum,
                        socialMediaGroup: c.socialMediaGroup ?? 'main',
                        mainLink: c.mainLink ?? c.videoLink ?? '',
                        descriptions: descriptions,
                        taggedUser: c.taggedUser ?? c.storyTag,
                        taggedLink: c.taggedLink ?? c.swipeUpLink,
                        additionalBrief: c.additionalBrief ?? c.specialWishes,
                    } satisfies CampaignContentItem;
                });

                // proceeding added accounts array
                const addedAccounts = legacySelect.map((acc) => {
                    const influencerId = this.oid(acc.influencerId);
                    const social = this.socialField(acc.socialMedia);

                    const username = (acc.username ?? acc.socialMediaUsername ?? '').toString().trim();

                    // if legacy accountId field exists — use it
                    // otherwise trying to find with influencerId+social+username
                    let resolvedAccountId = this.oid(acc.accountId);
                    if (!resolvedAccountId && influencerId && username) {
                        const key = `${String(influencerId)}:${social}:${username}`;
                        resolvedAccountId = accountMap.get(key) ?? null;
                    }

                    if (!resolvedAccountId) missingAccountId++;

                    const selected = acc.selectedContent;

                    // id of selected campaign content
                    const selectedContentItemId =
                        typeof selected === 'string' || selected instanceof Types.ObjectId
                            ? this.oid(selected)
                            : this.oid(selected.campaignContentItemId);

                    // if postDescriptions array exists take postDescriptionId as descriptionId
                    // otherwise trying to get descriptionId from new campaignContent array
                    const selectedDescriptionId =
                        typeof selected === 'string' || selected instanceof Types.ObjectId
                            ? campaignContent.find(i => i._id === selectedContentItemId)?.descriptions[0]?._id ?? undefined
                            : this.oid(selected.postDescriptionId);

                    return {
                        // _ids
                        _id: this.oid(acc._id) ?? new Types.ObjectId(),
                        influencerId,
                        accountId: resolvedAccountId,

                        // social account info
                        socialMedia: acc.socialMedia as SocialMediaEnum,
                        username: username,
                        price: this.num(acc.price) ?? 0,
                        publicPrice: this.num(acc.publicPrice) ?? 0,
                        followers: (acc as any).followers ?? acc.followersNumber ?? 0,

                        // promo statuses
                        confirmation: acc.confirmation as InfluencerConfirmationStatusEnum ?? InfluencerConfirmationStatusEnum.wait,
                        closePromo: acc.closePromo as InfluencerPromoClosedStatusEnum ?? InfluencerPromoClosedStatusEnum.wait,

                        // selected content for this promo
                        selectedContent: {
                            campaignContentItemId: selectedContentItemId,
                            descriptionId: selectedDescriptionId
                        },

                        dateRequest: acc.dateRequest ?? undefined,

                        // post's results (if insights sent)
                        postLink: acc.postLink ?? undefined,
                        screenshot: acc.screenshot ?? undefined,
                        impressions: this.num(acc.impressions) ?? undefined,
                        like: this.num(acc.like) ?? undefined,
                        comments: this.num(acc.comments) ?? undefined,
                        shares: this.num(acc.shares) ?? undefined,
                        saves: this.num(acc.saves) ?? undefined,
                        rating: this.num(acc.rating) ?? undefined,

                        // meta
                        adminChecked: acc.adminChecked ?? false,
                        createdAt: (acc as any).createdAt,
                        updatedAt: (acc as any).updatedAt,
                    } satisfies CampaignAccount;
                });

                // mapping legacy statuses
                const { legacyStatus, legacyVerify } = this.getLegacyCampaignFields(doc);

                const verifyCampaign = this.mapCampaignVerify(legacyVerify);
                const statusCampaign = this.mapCampaignStatus(legacyStatus, legacyVerify);

                const updatePipeline = [
                    {
                        $set: {
                            addedAccounts,
                            campaignContent,
                            paymentStatus: 'confirmed',
                            verifyCampaign,
                            statusCampaign,
                            schemaVersion: 2,
                        },
                    },
                    {
                        $unset: [
                            // campaign legacy fields
                            'selectInfluencers',
                            'statusPromo',
                            'verifyPromo',

                            // campaign content legacy fields
                            'campaignContent.videoLink',
                            'campaignContent.postDescription',
                            'campaignContent.storyTag',
                            'campaignContent.swipeUpLink',
                            'campaignContent.specialWishes',

                            // added accounts legacy fields
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
                        filter: {_id: doc._id},
                        update: updatePipeline,
                    },
                });
            }

            if (!dryRun && bulk.length) {
                const res = await this.campaignModel.collection.bulkWrite(bulk, {ordered: false});
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


    // Migrating influencers after updating schema
    async migrateInfluencersSocialAccountsV2(dto: MigrateCampaignsDto) {
        const limit = dto.limit ?? 200;
        const dryRun = !!dto.dryRun;
        let lastId = this.oid(dto.startAfterId);

        let scanned = 0;
        let updated = 0;

        const socials = ['instagram', 'tiktok', 'spotify', 'soundcloud', 'facebook', 'youtube', 'press'];

        while (true) {
            const filter: any = {
                $or: [{schemaVersion: {$exists: false}}, {schemaVersion: {$lt: 2}}],
            };
            if (lastId) filter._id = {$gt: lastId};

            const docs = await this.influencerModel
                .find(filter)
                .sort({_id: 1})
                .limit(limit)
                .lean();

            if (!docs.length) break;

            const bulk: any[] = [];

            for (const doc of docs) {
                scanned++;
                lastId = doc._id as any;

                const $set: any = {schemaVersion: 2, updatedAt: new Date()};
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

                const updatePipeline = [{$set}];

                if (dryRun) {
                    this.logger.log(`[dryRun] influencer=${String(doc._id)} touched=${touched}`);
                    continue;
                }

                bulk.push({
                    updateOne: {
                        filter: {_id: doc._id},
                        update: updatePipeline, // pipeline update
                    },
                });
            }

            if (!dryRun && bulk.length) {
                // ВАЖНО: через collection, чтобы не было кастинга mongoose
                const res = await this.influencerModel.collection.bulkWrite(bulk, {ordered: false});
                updated += res.modifiedCount ?? 0;

                this.logger.log(
                    `batch: scanned=${docs.length}, matched=${res.matchedCount}, modified=${res.modifiedCount}`,
                );
            }
        }

        return {ok: true, dryRun, scanned, updated};
    }
}