import {InjectModel} from '@nestjs/mongoose';
import {Injectable, Logger} from '@nestjs/common';
import {Model, Types} from 'mongoose';
import {Promos} from '../promos/schemas/promo.schema';
import {ReqUpdatePostDetailsDto} from './dto/req-update-post-details.dto';
import {ReqUpdateAllPostsDetailsDto} from "./dto/req-update-all-posts-details-dto";
import {ScrapersGateway} from "./scrapers.gateway";
import {InstagramAdapter} from "./adapters/instagram.adapter";
import {TikTokAdapter} from "./adapters/tiktok.adapter";
import {findScrapedAccountDetailsMatch, findScrapedPostDetailsMatch} from "./adapters/scraper.adapter";
import {ReqUpdateAllAccountsDto} from "./dto/req-update-all-accounts.dto";
import {Influencer, SocialAccount} from "../auth/schemas/influencer.schema";
import {cleanAccountUrl} from "../utils/socialMedia";

@Injectable()
export class ScrapersService {
    private readonly logger = new Logger();
    private readonly adapterMap = {
        instagram: new InstagramAdapter(),
        tiktok: new TikTokAdapter(),
    };

    constructor(
        @InjectModel(Promos.name) private readonly campaignsModel: Model<Promos>,
        @InjectModel(Influencer.name) private readonly influencersModel: Model<Influencer>,
        private readonly scrapersGateway: ScrapersGateway,
    ) {
    }

    private async scrapePostDetailsBatch(
        accountsBatch: {
            socialMediaUsername: string;
            accountId: string;
            postLink: string;
            impressions: string;
            like: string;
        }[],
        socialMedia: string,
        userId: string,
        maxRetries: number | undefined = 2,
    ) {
        let attempt = 0;
        const results: Record<string, any> = {};

        while (attempt <= maxRetries) {
            try {
                const urls = accountsBatch.map(a => a.postLink);

                const adapter = this.adapterMap[socialMedia];
                if (!adapter) {
                    throw new Error(`[SCRAPER] Unsupported social media: ${socialMedia} was used while scraping posts`);
                }

                const items = await adapter.runPostDetailsScraper(urls);

                for (const acc of accountsBatch) {
                    const match = findScrapedPostDetailsMatch(items, acc);
                    if (match) {
                        const newImpressions = match.views ?? 0;
                        const newLikes = match.likes ?? 0;

                        results[acc.accountId] = {
                            success: true,
                            newImpressions: newImpressions > 0 ? newImpressions.toString() : acc.impressions,
                            newLikes: newLikes > 0 ? newLikes.toString() : acc.like,
                        };
                        if (userId) {
                            this.scrapersGateway.refreshPostDetailsStatusUpdate(userId, {
                                accountId: acc.accountId,
                                account: acc.socialMediaUsername,
                                success: true,
                                newImpressions: results[acc.accountId].newImpressions,
                                newLikes: results[acc.accountId].newLikes,
                            });
                        }
                    } else {
                        results[acc.accountId] = {success: false};
                    }
                }
                break;
            } catch (e) {
                attempt++;
                this.logger.error(`[SCRAPER] Posts batch attempt ${attempt} failed: ${e.message}`);
                if (attempt > maxRetries) {
                    accountsBatch.forEach(acc => {
                        results[acc.accountId] = {success: false};
                        if (userId) {
                            this.scrapersGateway.refreshPostDetailsStatusUpdate(userId, {
                                accountId: acc.accountId,
                                account: acc.socialMediaUsername,
                                success: false,
                                newImpressions: acc.impressions,
                                newLikes: acc.like,
                            });
                        }
                    });
                }
            }
        }

        return results;
    }

    private async scrapeAccountDetailsBatch(
        accountsBatch: {
            accountId: string;
            socialMediaUsername: string;
            accountLink: string;
            oldLogo: string;
            oldFollowers: string;
        }[],
        socialMedia: string,
        userId: string,
        maxRetries: number | undefined = 2,
    ) {
        let attempt = 0;
        const results: Record<string, any> = {};

        while (attempt <= maxRetries) {
            try {
                const urls = accountsBatch.map(a => a.accountLink);

                const adapter = this.adapterMap[socialMedia];
                if (!adapter) {
                    throw new Error(`[SCRAPER] Unsupported social media: ${socialMedia} was used while scraping accounts`);
                }

                const items = await adapter.runAccountDetailsScraper(urls);

                for (const acc of accountsBatch) {
                    const match = findScrapedAccountDetailsMatch(items, acc);

                    if (match) {
                        const newFollowers: number | undefined = match.followers ?? 0;
                        const newLogo: string | undefined = match.logoUrl ?? undefined;

                        results[acc.accountId] = {
                            success: true,
                            newFollowers: newFollowers > 0 ? newFollowers.toString() : acc.oldFollowers,
                            newLogo: newLogo ? newLogo : acc.oldLogo,
                        };
                        if (userId) {
                            this.scrapersGateway.refreshAccountStatusUpdate(userId, {
                                accountId: acc.accountId,
                                account: acc.socialMediaUsername,
                                success: true,
                                newFollowers: results[acc.accountId].newFollowers,
                                newLogo: results[acc.accountId].newLogo,
                            });
                        }
                    } else {
                        results[acc.accountId] = {success: false};
                    }
                }
                break;
            } catch (e) {
                attempt++;
                this.logger.error(`[SCRAPER] Accounts batch attempt ${attempt} failed: ${e.message}`);
                if (attempt > maxRetries) {
                    accountsBatch.forEach(acc => {
                        results[acc.accountId] = {success: false};
                        if (userId) {
                            this.scrapersGateway.refreshPostDetailsStatusUpdate(userId, {
                                accountId: acc.accountId,
                                account: acc.socialMediaUsername,
                                success: false,
                                newFollowers: acc.oldFollowers,
                                newLogo: acc.oldLogo,
                            });
                        }
                    });
                }
            }
        }

        return results;
    }

    async updatePostDetailsInCampaign(data: ReqUpdatePostDetailsDto) {
        const startTime = Date.now();
        const campaign = await this.campaignsModel.findById(data.campaignId);
        if (!campaign) return {code: 404, message: 'Campaign not found'};

        const accountPostDetails = campaign.selectInfluencers.find(
            i => i._id.toString() === data.accountId && ['instagram', 'tiktok'].includes(i.socialMedia),
        );
        if (!accountPostDetails?.postLink) {
            return {code: 400, message: `Can't find required account or social media isn't supported`};
        }

        this.scrapersGateway.startAccountPostDetailsUpdate(data.refreshInitiatorId, data.campaignId, [data.accountId]);

        try {
            const resultMap = await this.scrapePostDetailsBatch(
                [
                    {
                        accountId: accountPostDetails._id.toString(),
                        socialMediaUsername: accountPostDetails.socialMediaUsername,
                        postLink: accountPostDetails.postLink,
                        impressions: accountPostDetails.impressions,
                        like: accountPostDetails.like,
                    },
                ],
                accountPostDetails.socialMedia,
                data.refreshInitiatorId
            );

            const scraped = resultMap[accountPostDetails._id.toString()];
            if (!scraped?.success) {
                this.scrapersGateway.finishAccountPostDetailsUpdate(data.refreshInitiatorId, data.campaignId, [data.accountId]);
                return {code: 422, message: "[SCRAPER] No data returned"};
            }

            await this.campaignsModel.updateOne(
                {
                    _id: new Types.ObjectId(data.campaignId),
                    'selectInfluencers._id': new Types.ObjectId(data.accountId),
                },
                {
                    $set: {
                        'selectInfluencers.$.impressions': scraped.newImpressions ?? accountPostDetails.impressions,
                        'selectInfluencers.$.like': scraped.newLikes ?? accountPostDetails.like,
                    },
                },
            );

            this.scrapersGateway.finishAccountPostDetailsUpdate(data.refreshInitiatorId, data.campaignId, [data.accountId]);

            const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
            this.logger.log(`[SCRAPER] updatePostDetailsInCampaign executed in ${durationSec}s`);

            return {
                code: 200,
                message: `${accountPostDetails.socialMediaUsername} post details updated!`,
                newImpressions: scraped.newImpressions ?? accountPostDetails.impressions,
                newLikes: scraped.newLikes ?? accountPostDetails.like,
            };
        } catch (e) {
            this.logger.error(
                `[SCRAPER] Error updating post details for ${accountPostDetails.socialMediaUsername}: ${e.message}`,
                e.stack
            );
            return {
                code: 502,
                message: `[SCRAPER] Failed to fetch data for account ${accountPostDetails.socialMediaUsername}`,
            };
        }
    }

    async updateAllPostsDetailsInCampaign(data: ReqUpdateAllPostsDetailsDto) {
        try {
            const startTime = Date.now();
            const campaign = await this.campaignsModel.findById(data.campaignId);
            if (!campaign) return {code: 404, message: `Campaign not found`};

            const accounts = campaign.selectInfluencers.filter(
                acc => ['instagram', 'tiktok'].includes(acc.socialMedia) && !!acc.postLink
            );

            const BATCH_SIZE = 10;
            const MAX_PARALLEL = 5;
            const failed: typeof accounts = [];
            const active: Promise<void>[] = [];

            this.scrapersGateway.startAccountPostDetailsUpdate(
                data.refreshInitiatorId,
                data.campaignId,
                accounts.map(a => a._id.toString())
            );

            // Группируем аккаунты по соцсети
            const groupedAccounts: Record<string, typeof accounts> = accounts.reduce((acc, account) => {
                if (!acc[account.socialMedia]) acc[account.socialMedia] = [];
                acc[account.socialMedia].push(account);
                return acc;
            }, {} as Record<string, typeof accounts>);

            const processBatch = async (batch: any[]) => {
                const formattedBatch = batch.map(acc => ({
                    accountId: acc._id.toString(),
                    socialMediaUsername: acc.socialMediaUsername,
                    postLink: acc.postLink,
                    impressions: acc.impressions,
                    like: acc.like,
                }));

                const resultMap = await this.scrapePostDetailsBatch(formattedBatch, batch[0].socialMedia, data.refreshInitiatorId);

                for (const acc of batch) {
                    const result = resultMap[acc._id.toString()];
                    if (result?.success) {
                        acc.impressions = result.newImpressions ?? acc.impressions;
                        acc.like = result.newLikes ?? acc.like;
                    } else {
                        failed.push(acc);
                    }
                    this.scrapersGateway.finishAccountPostDetailsUpdate(data.refreshInitiatorId, data.campaignId, [acc._id.toString()]);
                }
            };

            // Проходим по каждой соцсети
            for (const socialMedia of Object.keys(groupedAccounts)) {
                const queue = [...groupedAccounts[socialMedia]];

                while (queue.length > 0 || active.length > 0) {
                    while (queue.length > 0 && active.length < MAX_PARALLEL) {
                        const batch = queue.splice(0, BATCH_SIZE);
                        const p = processBatch(batch).finally(() => active.splice(active.indexOf(p), 1));
                        active.push(p);
                    }
                    await Promise.race(active);
                }
            }

            // Повторная попытка для неудачных
            if (failed.length) {
                this.logger.warn(`[SCRAPER] Retrying ${failed.length} failed accounts...`);

                const retryGrouped = failed.reduce((acc, account) => {
                    if (!acc[account.socialMedia]) acc[account.socialMedia] = [];
                    acc[account.socialMedia].push(account);
                    return acc;
                }, {} as Record<string, typeof failed>);

                for (const socialMedia of Object.keys(retryGrouped)) {
                    const resultMap = await this.scrapePostDetailsBatch(
                        retryGrouped[socialMedia].map(acc => ({
                            accountId: acc._id.toString(),
                            socialMediaUsername: acc.socialMediaUsername,
                            postLink: acc.postLink,
                            impressions: acc.impressions,
                            like: acc.like,
                        })),
                        socialMedia,
                        data.refreshInitiatorId
                    );

                    for (const acc of retryGrouped[socialMedia]) {
                        const result = resultMap[acc._id.toString()];
                        if (result?.success) {
                            acc.impressions = result.newImpressions ?? acc.impressions;
                            acc.like = result.newLikes ?? acc.like;
                            this.scrapersGateway.finishAccountPostDetailsUpdate(data.refreshInitiatorId, data.campaignId, [acc._id.toString()]);
                        }
                    }
                }
            }

            campaign.markModified("selectInfluencers");
            await campaign.save();

            this.scrapersGateway.notificationFinishedRefreshingPostDetails(data.refreshInitiatorId, {
                campaignName: campaign.campaignName,
                statusCode: 201,
            });

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            this.logger.log(`[SCRAPER] updateAllPostsDetailsInCampaign completed in ${duration}s`);

            return {
                code: 200,
                message: `Processed ${accounts.length} accounts in batches of ${BATCH_SIZE}, retried ${failed.length}`,
            };
        } catch (e) {
            this.logger.error(`[SCRAPER] Unexpected error: ${e.message}`, e.stack);
            this.scrapersGateway.notificationFinishedRefreshingPostDetails(data.socketId, {
                campaignName: data.campaignName,
                statusCode: 500,
            });
            return {code: 500, message: "Unexpected error"};
        }
    }

    async updateAllAccountsDetails(data: ReqUpdateAllAccountsDto) {
        try {
            const startTime = Date.now();
            const { socialMedia, socketId } = data;

            if (socialMedia !== 'tiktok')
                return { code: 400, message: 'Only TikTok accounts available.' };

            /** Получение всех инфлюенсеров с нужной соцсетью */
            const influencers = await this.influencersModel.find({
                [socialMedia]: { $exists: true, $ne: [] },
            }).lean().exec();
            if (!influencers || influencers.length === 0)
                return { code: 404, message: `Accounts from ${socialMedia} were not found` };

            /** Создание плоский массив всех аккаунтов и сохранение ссылки на инфлюенсера */
            const accounts = influencers.flatMap(inf => {
                const accounts = inf[socialMedia] || [];

                return accounts
                    .filter(acc => {
                        if (!acc?._id) {
                            this.logger.warn(
                                `[SCRAPER] У аккаунта инфлюенсера ${inf._id?.toString() ?? 'UNKNOWN'} отсутствует _id (${socialMedia})`
                            );
                            return false;
                        }
                        return true;
                    })
                    .map(acc => ({
                        ...acc,
                        _idInfluencer: inf._id?.toString() ?? null,
                    }));
            });

            this.scrapersGateway.startAccountAccountsUpdate(
                socketId,
                socialMedia,
                accounts.map(a => (a as any)._id.toString())
            );

            const BATCH_SIZE = 10;
            const MAX_PARALLEL = 3;
            const failed: typeof accounts = [];
            const active: Promise<void>[] = [];

            /** Функция обработки одного батча */
            const processBatch = async (batch: typeof accounts) => {
                const formattedBatch = batch.map(acc => ({
                    accountId: acc._id.toString(),
                    socialMediaUsername: acc.instagramUsername,
                    accountLink: cleanAccountUrl(acc.instagramLink, 'tiktok'),
                    oldFollowers: acc.followersNumber ?? "0",
                    oldLogo: acc.logo ?? "",
                }));

                const resultMap = await this.scrapeAccountDetailsBatch(
                    formattedBatch,
                    socialMedia,
                    socketId
                );

                for (const acc of batch) {
                    const result = resultMap[acc._id.toString()];
                    if (!result?.success) failed.push(acc);

                    /** Локальное обновление аккаунта */
                    acc.followersNumber = result?.newFollowers ?? acc.followersNumber;
                    acc.logo = result?.newLogo ?? acc.logo;

                    this.scrapersGateway.finishAccountAccountsUpdate(
                        socketId,
                        socialMedia,
                        [acc._id.toString()]
                    );
                }
            };

            /** Основная очередь батчей */
            const queue = [...accounts];
            while (queue.length > 0 || active.length > 0) {
                while (queue.length > 0 && active.length < MAX_PARALLEL) {
                    const batch = queue.splice(0, BATCH_SIZE);
                    const p = processBatch(batch).finally(() => active.splice(active.indexOf(p), 1));
                    active.push(p);
                }
                await Promise.race(active);
            }

            /** Повторная попытка для неудачных */
            if (failed.length > 0) {
                this.logger.warn(`[SCRAPER] Retrying ${failed.length} failed accounts...`);
                const retryQueue = [...failed];
                failed.length = 0;

                while (retryQueue.length > 0 || active.length > 0) {
                    while (retryQueue.length > 0 && active.length < MAX_PARALLEL) {
                        const batch = retryQueue.splice(0, BATCH_SIZE);
                        const p = processBatch(batch).finally(() => active.splice(active.indexOf(p), 1));
                        active.push(p);
                    }
                    await Promise.race(active);
                }
            }

            /** Группировка аккаунтов по инфлюенсерам */
            const updatesMap: Record<string, SocialAccount[]> = {};
            accounts.forEach(acc => {
                if (!updatesMap[acc._idInfluencer]) updatesMap[acc._idInfluencer] = [];
                updatesMap[acc._idInfluencer].push(acc);
            });

            /** Обновление инфлюенсеров по одному */
            for (const [infId, updatedAccounts] of Object.entries(updatesMap)) {
                await this.influencersModel.updateOne(
                    { _id: new Types.ObjectId(infId) },
                    { $set: { [socialMedia]: updatedAccounts } }
                );
            }

            this.scrapersGateway.notificationFinishedRefreshingAccounts(socketId, {
                socialMedia,
                statusCode: 201,
            });

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            this.logger.log(`[SCRAPER] updateAllAccountsDetails completed in ${duration}s`);

            return {
                code: 200,
                message: `Processed ${accounts.length} ${socialMedia} accounts in batches of ${BATCH_SIZE}`,
            };
        } catch (e) {
            this.logger.error(`[SCRAPER] updateAllAccountsDetails failed: ${e.message}`, e.stack);
            this.scrapersGateway.notificationFinishedRefreshingAccounts(data.socketId, {
                socialMedia: data.socialMedia,
                statusCode: 500,
            });
            return { code: 500, message: "Internal Server Error" };
        }
    }
}
