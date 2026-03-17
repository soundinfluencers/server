import {
    BadGatewayException, BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException
} from '@nestjs/common';
import {Types} from 'mongoose';
import {ReqUpdatePostDetailsDto} from './dto/req-update-post-details.dto';
import {ReqUpdateAllPostsDetailsDto} from "./dto/req-update-all-posts-details-dto";
import {ScrapersGateway} from "./scrapers.gateway";
import {InstagramAdapter} from "./adapters/instagram.adapter";
import {TikTokAdapter} from "./adapters/tiktok.adapter";
import {findScrapedAccountDetailsMatch, findScrapedPostDetailsMatch} from "./adapters/scraper.adapter";
import {ReqUpdateAllAccountsDto} from "./dto/req-update-all-accounts.dto";
import {FacebookAdapter} from "./adapters/facebook.adapter";
import {cleanAccountUrl} from "../../common/utils/socialMedia";
import {SocialAccount} from "../../database/schemas/users/influencer.schema";
import {CampaignRepository} from "../../database/repositories/campaigns/campaign.repository";
import {InfluencerRepository} from "../../database/repositories/users/influencer.repository";
import {UpdatePostDetailsResponse} from "./types/scraper-response.types";
import {ScraperAvailableSocialMedias} from "./types/scraper.types";

@Injectable()
export class ScrapersService {
    private readonly logger = new Logger();

    // All available adapters
    private readonly adapterMap = {
        instagram: new InstagramAdapter(),
        tiktok: new TikTokAdapter(),
        facebook: new FacebookAdapter(),
    };
    private readonly availableSocialMedias = Object.values(ScraperAvailableSocialMedias) as string[];

    // Limitations to avoid overloading Apify
    private currentRuns: number = 0;
    private areAccountsRefreshing = false;

    constructor(
        private readonly campaignRepository: CampaignRepository,
        private readonly influencerRepository: InfluencerRepository,
        private readonly scrapersGateway: ScrapersGateway,
    ) {
    }

    // todo: remove socketId from each dto. client doesn't need to send this. better to make websocket service understand which socket is using (by userId)

    // Scrapes batches of post details
    private async scrapePostDetailsBatch(
        accountsBatch: {
            socialMediaUsername: string;
            accountId: string;
            postLink: string;
            impressions: number;
            like: number;
        }[],
        socialMedia: string,
        userId: string,
        maxRetries: number | undefined = 2,
    ): Promise<Record<string, any>> {
        this.currentRuns++;

        let attempt = 0;
        const results: Record<string, any> = {};

        try {
            while (attempt <= maxRetries) {
                try {
                    const urls = accountsBatch.map(a => a.postLink);

                    const adapter = this.adapterMap[socialMedia];
                    if (!adapter) {
                        this.logger.error(`[SCRAPER] Unsupported social media: ${socialMedia}`);
                        accountsBatch.forEach(acc => {
                            results[acc.accountId] = {success: false};
                        });
                        break;
                    }

                    const items = await adapter.runPostDetailsScraper(urls);

                    for (const acc of accountsBatch) {
                        const match = findScrapedPostDetailsMatch(items, acc);
                        if (match) {
                            const newImpressions = match.views ?? 0;
                            const newLikes = match.likes ?? 0;

                            results[acc.accountId] = {
                                success: true,
                                newImpressions: newImpressions > 0 ? newImpressions : acc.impressions,
                                newLikes: newLikes > 0 ? newLikes : acc.like,
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
        } catch (error) {
            this.logger.error(`[SCRAPER] Posts batch attempt ${attempt}/${maxRetries} failed: ${error.message}`,);
        } finally {
            this.currentRuns--;
        }
        return results;
    }

    // Scrapes batches of account details
    private async scrapeAccountDetailsBatch(
        accountsBatch: {
            accountId: string;
            socialMediaUsername: string;
            accountLink: string;
            oldLogo: string;
            oldFollowers: number;
            oldEngagementRate: number;
            oldAverageViews: number;
        }[],
        socialMedia: string,
        userId: string,
        maxRetries: number | undefined = 2,
    ): Promise<Record<string, any>> {
        this.currentRuns++;

        let attempt = 0;
        const results: Record<string, any> = {};

        try {
            while (attempt <= maxRetries) {
                try {
                    const urls = accountsBatch.map(a => a.accountLink);

                    const adapter = this.adapterMap[socialMedia];
                    if (!adapter) {
                        this.logger.error(`[SCRAPER] Unsupported social media: ${socialMedia}`);
                        accountsBatch.forEach(acc => {
                            results[acc.accountId] = {success: false};
                        });
                        break;
                    }

                    const items = await adapter.runAccountDetailsScraper(urls);

                    for (const acc of accountsBatch) {
                        const match = findScrapedAccountDetailsMatch(items, acc);

                        if (match) {
                            const newFollowers: number | undefined = match.followers ?? undefined;
                            const newLogo: string | undefined = match.logoUrl ?? undefined;
                            const newEngagementRate: number | undefined = match.engagementRate ?? undefined;
                            const newAverageViews: number | undefined = match.averageViews ?? undefined;

                            results[acc.accountId] = {
                                success: true,
                                newFollowers: newFollowers > 0 ? newFollowers.toString() : acc.oldFollowers,
                                newLogo: newLogo ? newLogo : acc.oldLogo,
                                newEngagementRate: newEngagementRate ?? acc.oldEngagementRate,
                                newAverageViews: newAverageViews ?? acc.oldAverageViews,
                            };
                            if (userId) {
                                this.scrapersGateway.refreshAccountStatusUpdate(userId, {
                                    accountId: acc.accountId,
                                    account: acc.socialMediaUsername,
                                    success: true,
                                    newFollowers: results[acc.accountId].newFollowers,
                                    newLogo: results[acc.accountId].newLogo,
                                    newEngagementRate: results[acc.accountId].newEngagementRate,
                                    newAverageViews: results[acc.accountId].newAverageViews,
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
                                    newEngagementRate: acc.oldEngagementRate,
                                    newAverageViews: acc.oldAverageViews,
                                });
                            }
                        });
                    }
                }
            }
        } catch (error) {
            this.logger.error(`[SCRAPER] Accounts batch attempt ${attempt}/${maxRetries} failed: ${error.message}`, error instanceof Error ? error.stack : new Error().stack);
        } finally {
            this.currentRuns--;
        }
        return results;
    }

    // Updates one account's post details in campaign
    async updatePostDetailsInCampaign(data: ReqUpdatePostDetailsDto): Promise<UpdatePostDetailsResponse> {
        if (this.currentRuns >= 30) throw new ServiceUnavailableException('Service unavailable currently')

        const startTime = Date.now();
        const campaign = await this.campaignRepository.findById(data.campaignId);
        if (!campaign) throw new NotFoundException(`Campaign ${data.campaignId} not found`)

        const accountPostDetails = campaign.addedAccounts.find(
            i => i._id.toString() === data.accountId && this.availableSocialMedias.includes(i.socialMedia),
        );
        if (!accountPostDetails) {
            throw new NotFoundException(`Account ${data.accountId} was not found in campaign ${data.campaignId}`);
        }
        if (!this.availableSocialMedias.includes(accountPostDetails.socialMedia)) {
            throw new ConflictException(`Social media ${accountPostDetails.socialMedia} is not supported`);
        }

        if (!accountPostDetails.postLink) {
            throw new ConflictException(`Post link is missing for account ${accountPostDetails.username} in campaign ${data.campaignId}`);
        }

        this.scrapersGateway.startAccountPostDetailsUpdate(data.refreshInitiatorId, data.campaignId, [data.accountId]);

        const resultMap = await this.scrapePostDetailsBatch(
            [
                {
                    accountId: accountPostDetails._id.toString(),
                    socialMediaUsername: accountPostDetails.username,
                    postLink: accountPostDetails.postLink,
                    impressions: accountPostDetails.impressions,
                    like: accountPostDetails.like,
                },
            ],
            accountPostDetails.socialMedia,
            data.refreshInitiatorId
        );

        const scraped = resultMap[accountPostDetails._id.toString()];

        // if everything was perfect, but for some reason scraper didn't do his work correctly
        if (!scraped?.success) {
            this.scrapersGateway.finishAccountPostDetailsUpdate(data.refreshInitiatorId, data.campaignId, [data.accountId]);
            throw new BadGatewayException('Failed to scrape post details from external service');
        }

        await this.campaignRepository.updateOne(
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
            message: `${accountPostDetails.username} post details updated!`,
            newImpressions: scraped.newImpressions ?? accountPostDetails.impressions,
            newLikes: scraped.newLikes ?? accountPostDetails.like,
        };
    }

    // Updates all post details for available social medias in campaign
    async updateAllPostsDetailsInCampaign(data: ReqUpdateAllPostsDetailsDto): Promise<{ message: string }> {
        if (this.currentRuns >= 20 || this.areAccountsRefreshing === true) {
            throw new ServiceUnavailableException("Service unavailable currently")
        }

        const startTime = Date.now();
        const campaign = await this.campaignRepository.findById(data.campaignId);
        if (!campaign) {
            throw new NotFoundException(`Campaign not found: ${data.campaignId}`);
        }

        const accounts = campaign.addedAccounts.filter(
            acc => this.availableSocialMedias.includes(acc.socialMedia) && !!acc.postLink
        );

        // Settings for batches
        const BATCH_SIZE = 10;
        const MAX_PARALLEL = 5;

        // Arrays for processed accounts
        const failed: typeof accounts = [];
        const active: Promise<void>[] = [];

        try {
            this.scrapersGateway.startAccountPostDetailsUpdate(
                data.refreshInitiatorId,
                data.campaignId,
                accounts.map(a => a._id.toString())
            );

            // Grouping account by their social media
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

            // Processing each social media
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

            // Second attempt for failed accounts
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
                            socialMediaUsername: acc.username,
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

            return {message: `Processed ${accounts.length} accounts in batches of ${BATCH_SIZE}, retried ${failed.length}`};
        } catch (e) {
            this.scrapersGateway.notificationFinishedRefreshingPostDetails(data.socketId, {
                campaignName: data.campaignName,
                statusCode: 500,
            });
            throw e;
        }
    }

    // Updates all accounts for one social media
    async updateAllAccountsDetails(data: ReqUpdateAllAccountsDto): Promise<{ message: string }> {
        if (this.currentRuns > 10) throw new ServiceUnavailableException("Service unavailable currently")

        this.logger.log(`[SCRAPER] updateAllAccountsDetails started for ${data.socialMedia} accounts`);
        this.areAccountsRefreshing = true;

        const startTime = Date.now();
        const {socialMedia, socketId} = data;

        if (!this.availableSocialMedias.includes(socialMedia)) {
            throw new BadRequestException("Not supported social media");
        }

        // Getting all influencers with needed social media
        const influencers = await this.influencerRepository.findMany({
            [socialMedia]: {$exists: true, $ne: []},
        }, {lean: true});

        if (!influencers || influencers.length === 0) {
            throw new NotFoundException(`Accounts from ${socialMedia} were not found`)
        }

        const accounts = influencers.flatMap(inf => {
            const accounts = inf[socialMedia] || [];

            return accounts
                .filter(acc => {
                    if (!acc?._id) {
                        this.logger.warn(
                            `[SCRAPER] Influencer ${inf._id?.toString() ?? 'UNKNOWN'} has account without _id (${socialMedia})`
                        );
                        acc._id = new Types.ObjectId();
                    }
                    return true;
                })
                .map(acc => ({
                    ...acc,
                    _idInfluencer: inf._id?.toString() ?? null,
                }));
        });

        // Settings for batches
        const BATCH_SIZE = 10;
        // const MAX_PARALLEL = 15;
        const MAX_PARALLEL = 7;

        // Arrays for processed accounts
        const failed: typeof accounts = [];
        const active: Promise<void>[] = [];

        try {
            // this.scrapersGateway.startAccountAccountsUpdate(
            //     socketId,
            //     socialMedia,
            //     accounts.map(a => (a as any)._id.toString())
            // );

            // Func for processing one batch of accounts
            const processBatch = async (batch: typeof accounts) => {
                const formattedBatch = batch.map(acc => ({
                    accountId: acc._id.toString(),
                    socialMediaUsername: acc.username,
                    accountLink: cleanAccountUrl(acc.profileLink, 'tiktok'),
                    oldFollowers: acc.followers ?? 0,
                    oldLogo: acc.logoUrl ?? "",
                    oldEngagementRate: acc.engagementRate ?? 0,
                    oldAverageViews: acc.averageViews ?? 0,
                }));

                const resultMap = await this.scrapeAccountDetailsBatch(
                    formattedBatch,
                    socialMedia,
                    socketId
                );

                for (const acc of batch) {
                    const result = resultMap[acc._id.toString()];
                    if (!result?.success) failed.push(acc);

                    // Local updating account
                    acc.followers = result?.newFollowers ?? acc.followers;
                    acc.logoUrl = result?.newLogo ?? acc.logoUrl;
                    acc.engagementRate = result?.newEngagementRate ?? acc.engagementRate;
                    acc.averageViews = result?.newAverageViews ?? 0;

                    // this.scrapersGateway.finishAccountAccountsUpdate(
                    //     socketId,
                    //     socialMedia,
                    //     [acc._id.toString()]
                    // );
                }
            };

            // Main batches queue
            const queue = [...accounts];
            while (queue.length > 0 || active.length > 0) {
                while (queue.length > 0 && active.length < MAX_PARALLEL) {
                    const batch = queue.splice(0, BATCH_SIZE);
                    const p = processBatch(batch).finally(() => active.splice(active.indexOf(p), 1));
                    active.push(p);
                }
                await Promise.race(active);
            }

            // Second attempt for failed
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

            // Grouping social accounts by influencer
            const updatesMap: Record<string, SocialAccount[]> = {};
            accounts.forEach(acc => {
                if (!updatesMap[acc._idInfluencer]) updatesMap[acc._idInfluencer] = [];
                updatesMap[acc._idInfluencer].push(acc);
            });

            // Updating influencers one by one
            for (const [infId, updatedAccounts] of Object.entries(updatesMap)) {
                await this.influencerRepository.updateOne(
                    {_id: new Types.ObjectId(infId)},
                    {$set: {[socialMedia]: updatedAccounts}}
                );
            }

            // this.scrapersGateway.notificationFinishedRefreshingAccounts(socketId, {
            //     socialMedia,
            //     statusCode: 201,
            // });

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            this.logger.log(`[SCRAPER] updateAllAccountsDetails completed in ${duration}s`);

            return {
                message: `Processed ${accounts.length} ${socialMedia} accounts in batches of ${BATCH_SIZE}`,
            };
        } catch (e) {
            // this.scrapersGateway.notificationFinishedRefreshingAccounts(data.socketId, {
            //     socialMedia: data.socialMedia,
            //     statusCode: 500,
            // });
            throw e;
        } finally {
            this.areAccountsRefreshing = false;
        }
    }
}
