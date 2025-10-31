import { ApifyClient } from "apify-client";
import {ScraperAdapter} from "./scraper.adapter";
import {
    TikTokAccountDetailsItem,
    TikTokPostDetailsItem
} from "../types/scraper-post-details.types";
import {cleanAccountUrl} from "../../utils/socialMedia";
import {Logger} from "@nestjs/common";
import {account} from "dropbox";

export class TikTokAdapter implements ScraperAdapter<TikTokPostDetailsItem> {
    private readonly logger = new Logger();
    private client: ApifyClient;

    constructor() {
        this.client = new ApifyClient({ token: process.env.APIFY_TOKEN });
    }

    /** Метод для запуска скрейпинга деталей поста */
    async runPostDetailsScraper(urls: string[]): Promise<TikTokPostDetailsItem[]> {
        const run = await this.client.actor("clockworks/tiktok-scraper").call({
            postURLs: urls,
            resultsLimit: urls.length,
            memory: 1024,
        });

        const datasetRes = await this.client.dataset(run.defaultDatasetId).listItems();
        return datasetRes.items.map(i => this.normalizePostDetailsItem(i));
    }

    /** Метод для запуска скрейпинга деталей аккаунта */
    async runAccountDetailsScraper(urls: string[]): Promise<TikTokAccountDetailsItem[]> {
        const run = await this.client.actor("clockworks/tiktok-profile-scraper").call({
            profiles: urls,
            shouldDownloadCovers: false,
            shouldDownloadSlideshowImages: false,
            shouldDownloadSubtitles: false,
            shouldDownloadVideos: false,
            resultsPerPage: 13,
        });

        const datasetRes: any = await this.client.dataset(run.defaultDatasetId).listItems();

        const accounts: {
            accountUrl: string | undefined;
            username: string | undefined;
            logoUrl: string | undefined;
            followers: number | undefined;
            videosData: {
                views: number;
                likes: number;
                comments: number;
                shares: number;
            }[] | undefined;
        }[] = [];

        for (const item of datasetRes.items) {
            if (!item?.authorMeta?.profileUrl || item?.isPinned) continue;
            const cleanedAccountUrl: string = cleanAccountUrl(item?.authorMeta?.profileUrl, 'tiktok');

            const index: number = accounts.findIndex(acc => acc?.accountUrl === cleanedAccountUrl);

            if (index !== -1) {
                accounts[index].videosData.push({
                    views: item.playCount ?? 0,
                    likes: item.diggCount ?? 0,
                    comments: item.commentCount ?? 0,
                    shares: item.shareCount ?? 0
                })
            } else {
                accounts.push({
                    accountUrl: cleanedAccountUrl ?? undefined,
                    username: item?.authorMeta?.name ?? undefined,
                    logoUrl: item?.authorMeta?.avatar ?? undefined,
                    followers: item.authorMeta?.fans ?? undefined,
                    videosData: [{
                        views: item.playCount ?? 0,
                        likes: item.diggCount ?? 0,
                        comments: item.commentCount ?? 0,
                        shares: item.shareCount ?? 0
                    }] ?? undefined,
                })
            }
        }

        return accounts.map(i => this.normalizeAccountDetailsItem(i));
    }

    /** Метод для нормализации возвращаемых данных поста */
    normalizePostDetailsItem(item: any): TikTokPostDetailsItem {
        return {
            url: item.submittedVideoUrl,
            likes: item.diggCount ?? 0,
            views: item.playCount ?? 0,
            shares: item.shareCount ?? 0,
        };
    }

    /** Метод для нормализации возвращаемых данных аккаунта */
    normalizeAccountDetailsItem(item: {
        accountUrl: string | undefined;
        username: string | undefined;
        logoUrl: string | undefined;
        followers: number | undefined;
        videosData: {
            views: number;
            likes: number;
            comments: number;
            shares: number;
        }[] | undefined;
    }): TikTokAccountDetailsItem {
        const engagementRate: number | undefined = this.calculateEngagementRate({
            username: item.username,
            followersNumber: item.followers,
            videosData: item.videosData
        })

        const averageViews: number | undefined = this.calculateAverageViews({
            username: item.username,
            videosData: item.videosData
        })

        return {
            accountUrl: item.accountUrl ?? "",
            username: item.username ?? "",
            logoUrl: item.logoUrl ?? "",
            followers: item.followers ?? 0,
            engagementRate: engagementRate,
            averageViews: averageViews
        }
    }

    /** Метод расчёта engagement rate */
    calculateEngagementRate(
        item: {
            username: string;
            followersNumber: number | undefined;
            videosData: {
                views: number;
                likes: number;
                comments: number;
                shares: number;
            }[] | undefined;
        }
    ): number | undefined {
        if (!item?.videosData?.length) return undefined;

        try {
            const totalEngagement = item.videosData.reduce((sum, video) => {
                const likes = video.likes ?? 0;
                const comments = video.comments ?? 0;
                const shares = video.shares ?? 0;
                return sum + likes + comments + shares;
            }, 0);

            return item.followersNumber
                ? parseFloat(((totalEngagement / item.followersNumber) * 100).toFixed(2))
                : undefined;
        } catch (err: any) {
            this.logger.error(
                `Error calculating engagement rate for tiktok account ${item.username}: ${err.message}`
            );
            return undefined;
        }
    }

    /** Метод расчёта average views */
    calculateAverageViews(item: {
        username: string;
        videosData: {
            views: number;
            likes: number;
            comments: number;
            shares: number;
        }[] | undefined;
    }): number | undefined {
        if (!item?.videosData?.length) return undefined;

        try {
            const totalViews = item.videosData.reduce((sum, video) => {
                const views = video.views ?? 0;
                return sum + views;
            }, 0);

            return Math.round(totalViews / item.videosData.length);
        } catch (err: any) {
            this.logger.error(
                `Error calculating average views for tiktok account ${item.username}: ${err.message}`
            );
            return undefined;
        }
    }
}
