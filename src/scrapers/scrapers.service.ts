import {InjectModel} from '@nestjs/mongoose';
import {Offer} from '../offers/schemas/offer.schema';
import {Injectable, Logger} from '@nestjs/common';
import {Model} from 'mongoose';
import {Influencer} from '../auth/schemas/influencer.schema';
import {Promos} from '../promos/schemas/promo.schema';
import axios from 'axios';
import {ReqUpdatePostDetailsDto} from './dto/req-update-post-details.dto';
import {AppGateway} from "../websocket/app.gateway";
import {ApifyClient} from "apify-client";
import {ReqUpdateAllPostsDetailsDto} from "./dto/req-update-all-posts-details-dto";

@Injectable()
export class ScrapersService {
    private readonly logger = new Logger();
    private readonly apifyClient: ApifyClient;

    constructor(
        @InjectModel(Promos.name) private readonly campaignsModel: Model<Promos>,
        private readonly appGateway: AppGateway,
    ) {
        this.apifyClient = new ApifyClient({token: process.env.APIFY_TOKEN})
    }

    private async scrapePostDetails(accountPostDetails: {
        socialMediaUsername: string;
        accountId: string;
        postLink: string;
        impressions: string;
        like: string;
    }, socketId?: string, maxRetries = 2) {
        let attempt = 0;
        let result: any = null;
        while (attempt <= maxRetries) {
            try {
                const run = await this.apifyClient.actor("apify/instagram-scraper").call({
                    directUrls: [accountPostDetails.postLink],
                    resultsLimit: 1,
                });

                const datasetRes = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
                const items = datasetRes.items as any[];

                if (items.length) {
                    result = items[0];

                    const newImpressions: number = Math.max(result.videoPlayCount ?? 0, result.videoViewCount ?? 0);
                    const newLikes: number = result.likesCount;

                    if (socketId) {
                        this.appGateway.refreshPostDetailsStatusUpdate(socketId, {
                            accountId: accountPostDetails.accountId,
                            account: accountPostDetails.socialMediaUsername,
                            success: true,
                            newImpressions: newImpressions > 0 ? newImpressions.toString() : accountPostDetails.impressions,
                            newLikes: newLikes > 0 ? newLikes.toString() : accountPostDetails.like,
                            errorImpressions: newImpressions === 0 ? "Hidden Impressions" : undefined,
                            errorLikes: newLikes <= 0 ? "Hidden likes" : undefined,
                        });
                    }

                    result = {
                        newImpressions: newImpressions > 0 ? newImpressions.toString() : accountPostDetails.impressions,
                        newLikes: newLikes > 0 ? newLikes.toString() : accountPostDetails.like,
                    }
                    break;
                }
                attempt++;
            } catch (e) {
                attempt++;

                if (attempt > maxRetries && socketId) {
                    this.appGateway.refreshPostDetailsStatusUpdate(socketId, {
                        accountId: accountPostDetails.accountId,
                        account: accountPostDetails.socialMediaUsername,
                        success: false,
                        newImpressions: accountPostDetails.impressions,
                        newLikes: accountPostDetails.like,
                    });
                    this.logger.error(`[SCRAPER] Failed to scrape ${accountPostDetails.postLink} after ${maxRetries} retries: ${e.message}`);
                }
            }
        }
        return result;
    }

    async updatePostDetailsInCampaign(data: ReqUpdatePostDetailsDto) {
        const startTime: number = Date.now();

        const campaign = await this.campaignsModel.findById(data.campaignId);
        if (!campaign) return {code: 404, message: 'Campaign not found'};

        const accountPostDetails = campaign.selectInfluencers.find((i) => i._id.toString() === data.accountId && i.socialMedia === 'instagram');
        if (!accountPostDetails?.postLink) {
            return {code: 400, message: 'Post link not found for account'};
        }

        try {
            const scraped = await this.scrapePostDetails({
                    accountId: accountPostDetails._id.toString(),
                    socialMediaUsername: accountPostDetails.socialMediaUsername,
                    postLink: accountPostDetails.postLink,
                    impressions: accountPostDetails.impressions,
                    like: accountPostDetails.like,
                },
                data.socketId,
                2
            );

            if (!scraped) {
                return {code: 422, message: "[SCRAPER] No data returned"};
            }

            accountPostDetails.impressions = scraped.newImpressions ?? accountPostDetails.impressions;
            accountPostDetails.like = scraped.newLikes ?? accountPostDetails.like;

            campaign.markModified("selectInfluencers");
            await campaign.save();

            const endTime = Date.now();
            const durationSec = ((endTime - startTime) / 1000).toFixed(2);
            this.logger.log(`[SCRAPER] updatePostDetailsInCampaign executed in ${durationSec}s`);

            return {
                code: 200,
                message: `${accountPostDetails.socialMediaUsername} post details updated!`,
                newImpressions: accountPostDetails.impressions,
                newLikes: accountPostDetails.like
            };
        } catch (e) {
            this.logger.error(`[SCRAPER] Error updating post details for ${accountPostDetails.socialMediaUsername} : ${e.message}`,
                e.stack
            );
            return {
                code: 502,
                message: `[SCRAPER]Failed to fetch data for account ${accountPostDetails.socialMediaUsername}`
            };
        }
    }

    async updateAllPostsDetailsInCampaign(data: ReqUpdateAllPostsDetailsDto) {
        const startTime: number = Date.now();

        const campaign = await this.campaignsModel.findById(data.campaignId);
        if (!campaign) return {code: 404, message: `Campaign not found`};
        if (!campaign.selectInfluencers?.length) return {code: 204, message: `Empty campaign`};

        const accountsWithPosts = campaign.selectInfluencers.filter(acc => acc.socialMedia === 'instagram' && !!acc.postLink);

        const BATCH_SIZE = 5;
        for (let i = 0; i < accountsWithPosts.length; i += BATCH_SIZE) {
            const batch = accountsWithPosts.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.all(
                batch.map(acc => this.scrapePostDetails({
                        accountId: acc._id.toString(),
                        socialMediaUsername: acc.socialMediaUsername,
                        postLink: acc.postLink,
                        impressions: acc.impressions,
                        like: acc.like,
                    },
                    data.socketId,
                    2
                )));

            batchResults.forEach((scraped, idx) => {
                const acc = batch[idx];
                if (!scraped) {
                    return;
                }

                if (scraped.newImpressions) {
                    acc.impressions = scraped.newImpressions;
                }
                if (scraped.newLikes) {
                    acc.like = scraped.newLikes;
                }
            });

            await new Promise(r => setTimeout(r, 500));
        }

        campaign.markModified("selectInfluencers");
        await campaign.save();

        const endTime = Date.now();
        const durationSec = ((endTime - startTime) / 1000).toFixed(2);
        this.logger.log(`[SCRAPER] updateAllPostsDetailsInCampaign executed in ${durationSec}s`);

        return {
            code: 200,
            message: `Processed ${accountsWithPosts.length} accounts`,
        };
    }
}
