import { ApifyClient } from "apify-client";
import {ScraperAdapter} from "./scraper.adapter";
import {
    TikTokAccountDetailsItem,
    TikTokPostDetailsItem
} from "../types/scraper-post-details.types";
import {cleanAccountUrl} from "../../utils/socialMedia";

export class TikTokAdapter implements ScraperAdapter<TikTokPostDetailsItem> {
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
        const run = await this.client.actor("novi/tiktok-user-info-api").call({
            urls: urls,
            resultsLimit: urls.length,
            memory: 1024,
        });

        const datasetRes = await this.client.dataset(run.defaultDatasetId).listItems();
        return datasetRes.items.map(i => this.normalizeAccountDetailsItem(i));
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
    normalizeAccountDetailsItem(item: any): TikTokAccountDetailsItem {
        return {
            accountUrl: cleanAccountUrl(item?.share_info?.share_url, 'tiktok'),
            username: item.unique_id,
            logoUrl: item?.avatar_larger?.url_list[0] ?? "",
            followers: item.follower_count ?? 0,
        }
    }
}
