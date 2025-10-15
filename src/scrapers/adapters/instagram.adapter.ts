import {ScraperAdapter} from "./scraper.adapter";
import {ApifyClient} from "apify-client";
import {InstagramPostDetailsItem} from "../types/scraper-post-details.types";

export class InstagramAdapter implements ScraperAdapter<InstagramPostDetailsItem> {
    private client: ApifyClient;

    constructor() {
        this.client = new ApifyClient({ token: process.env.APIFY_TOKEN });
    }

    async runScraper(urls: string[]): Promise<InstagramPostDetailsItem[]> {
        const run = await this.client.actor("apify/instagram-scraper").call({
            directUrls: urls,
            resultsLimit: urls.length,

        });

        const datasetRes = await this.client.dataset(run.defaultDatasetId).listItems();
        return datasetRes.items.map(i => this.normalizeItem(i));
    }

    normalizeItem(item: any): InstagramPostDetailsItem {
        return {
            url: item.inputUrl,
            likes: item.likesCount ?? 0,
            views: item.videoPlayCount ?? item.videoViewCount ?? 0,
        };
    }
}