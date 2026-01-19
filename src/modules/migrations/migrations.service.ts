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
}