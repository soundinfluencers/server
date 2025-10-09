import {InjectModel} from '@nestjs/mongoose';
import {Injectable, Logger} from '@nestjs/common';
import {Model, Types} from 'mongoose';
import {Promos} from '../promos/schemas/promo.schema';
import {ReqUpdatePostDetailsDto} from './dto/req-update-post-details.dto';
import {ApifyClient} from "apify-client";
import {ReqUpdateAllPostsDetailsDto} from "./dto/req-update-all-posts-details-dto";
import {ScrapersGateway} from "./scrapers.gateway";

@Injectable()
export class ScrapersService {
    private readonly logger = new Logger();
    private readonly apifyClient: ApifyClient;

    constructor(
        @InjectModel(Promos.name) private readonly campaignsModel: Model<Promos>,
        private readonly scrapersGateway: ScrapersGateway,
    ) {
        this.apifyClient = new ApifyClient({token: process.env.APIFY_TOKEN});
    }

    private async scrapePostDetailsBatch(
        accountsBatch: {
            socialMediaUsername: string;
            accountId: string;
            postLink: string;
            impressions: string;
            like: string;
        }[],
        userId: string,
        maxRetries = 2,
    ) {
        let attempt = 0;
        const results: Record<string, any> = {};

        while (attempt <= maxRetries) {
            try {
                const urls = accountsBatch.map(a => a.postLink);
                const run = await this.apifyClient.actor("apify/instagram-scraper").call({
                    directUrls: urls,
                    resultsLimit: urls.length,
                });

                const datasetRes = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
                const items = datasetRes.items as any[];

                for (const acc of accountsBatch) {
                    const match = items.find(i => i.inputUrl === acc.postLink);
                    if (match) {
                        const newImpressions = Math.max(match.videoPlayCount ?? 0, match.videoViewCount ?? 0);
                        const newLikes = match.likesCount ?? 0;

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
                        results[acc.accountId] = { success: false };
                    }
                }
                break;
            } catch (e) {
                attempt++;
                this.logger.error(`[SCRAPER] Batch attempt ${attempt} failed: ${e.message}`);
                if (attempt > maxRetries) {
                    accountsBatch.forEach(acc => {
                        results[acc.accountId] = { success: false };
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

    async updatePostDetailsInCampaign(data: ReqUpdatePostDetailsDto) {
        const startTime = Date.now();
        const campaign = await this.campaignsModel.findById(data.campaignId);
        if (!campaign) return { code: 404, message: 'Campaign not found' };

        const accountPostDetails = campaign.selectInfluencers.find(
            i => i._id.toString() === data.accountId && i.socialMedia === 'instagram'
        );
        if (!accountPostDetails?.postLink) {
            return { code: 400, message: 'Post link not found for account' };
        }

        this.scrapersGateway.startAccountUpdate(data.refreshInitiatorId, data.campaignId, [data.accountId]);

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
                data.refreshInitiatorId
            );

            const scraped = resultMap[accountPostDetails._id.toString()];
            if (!scraped?.success) return { code: 422, message: "[SCRAPER] No data returned" };

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

            this.scrapersGateway.finishAccountUpdate(data.refreshInitiatorId, data.campaignId, [data.accountId]);

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
            if (!campaign) return { code: 404, message: `Campaign not found` };

            const accounts = campaign.selectInfluencers.filter(
                acc => acc.socialMedia === 'instagram' && !!acc.postLink
            );

            const BATCH_SIZE = 10;
            const MAX_PARALLEL = 3;
            const queue = [...accounts];
            const failed: typeof accounts = [];
            const active: Promise<void>[] = [];

            this.scrapersGateway.startAccountUpdate(
                data.refreshInitiatorId,
                data.campaignId,
                accounts.map(a => a._id.toString())
            );

            const processBatch = async (batch: any) => {
                const formattedBatch = batch.map((acc: any) => ({
                    accountId: acc._id.toString(),
                    socialMediaUsername: acc.socialMediaUsername,
                    postLink: acc.postLink,
                    impressions: acc.impressions,
                    like: acc.like,
                }));

                const resultMap = await this.scrapePostDetailsBatch(formattedBatch, data.refreshInitiatorId);

                for (const acc of batch) {
                    const result = resultMap[acc._id.toString()];
                    if (result?.success) {
                        acc.impressions = result.newImpressions ?? acc.impressions;
                        acc.like = result.newLikes ?? acc.like;
                    } else {
                        failed.push(acc);
                    }
                    this.scrapersGateway.finishAccountUpdate(data.refreshInitiatorId, data.campaignId, [acc._id.toString()]);
                }
            };

            while (queue.length > 0 || active.length > 0) {
                while (queue.length > 0 && active.length < MAX_PARALLEL) {
                    const batch = queue.splice(0, BATCH_SIZE);
                    const p = processBatch(batch).finally(() => active.splice(active.indexOf(p), 1));
                    active.push(p);
                }
                await Promise.race(active);
            }

            if (failed.length) {
                this.logger.warn(`[SCRAPER] Retrying ${failed.length} failed accounts...`);

                const formattedFailed = failed.map(acc => ({
                    accountId: acc._id.toString(),
                    socialMediaUsername: acc.socialMediaUsername,
                    postLink: acc.postLink,
                    impressions: acc.impressions,
                    like: acc.like,
                }));

                const retryResult = await this.scrapePostDetailsBatch(formattedFailed, data.refreshInitiatorId);

                for (const acc of failed) {
                    const result = retryResult[acc._id.toString()];
                    if (result?.success) {
                        acc.impressions = result.newImpressions ?? acc.impressions;
                        acc.like = result.newLikes ?? acc.like;
                        this.scrapersGateway.finishAccountUpdate(data.refreshInitiatorId, data.campaignId, [acc._id.toString()]);
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
            return { code: 500, message: "Unexpected error" };
        }
    }
}
