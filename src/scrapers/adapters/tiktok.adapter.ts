import { ApifyClient } from "apify-client";
import {ScraperAdapter} from "./scraper.adapter";
import {TikTokPostDetailsItem} from "../types/scraper-post-details.types";

export class TikTokAdapter implements ScraperAdapter<TikTokPostDetailsItem> {
    private client: ApifyClient;

    constructor() {
        this.client = new ApifyClient({ token: process.env.APIFY_TOKEN });
    }

    // этот скрэйпер так же позволяет получать лого, превью видео и много другого
    async runScraper(urls: string[]): Promise<TikTokPostDetailsItem[]> {
        const run = await this.client.actor("clockworks/tiktok-scraper").call({
            postURLs: urls,
            resultsLimit: urls.length,
        });

        const datasetRes = await this.client.dataset(run.defaultDatasetId).listItems();
        return datasetRes.items.map(i => this.normalizeItem(i));
    }

    normalizeItem(item: any): TikTokPostDetailsItem {
        return {
            url: item.submittedVideoUrl,
            likes: item.diggCount ?? 0,
            views: item.playCount ?? 0,
            shares: item.shareCount ?? 0,
        };
    }
}
