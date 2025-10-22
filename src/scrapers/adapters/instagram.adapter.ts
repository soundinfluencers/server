import {ScraperAdapter} from "./scraper.adapter";
import {ApifyClient} from "apify-client";
import {InstagramAccountDetailsItem, InstagramPostDetailsItem} from "../types/scraper-post-details.types";

export class InstagramAdapter implements ScraperAdapter<InstagramPostDetailsItem> {
    private client: ApifyClient;

    constructor() {
        this.client = new ApifyClient({ token: process.env.APIFY_TOKEN });
    }

    /** Метод для запуска скрейпинга деталей поста */
    async runPostDetailsScraper(urls: string[]): Promise<InstagramPostDetailsItem[]> {
        const run = await this.client.actor("apify/instagram-scraper").call({
            directUrls: urls,
            resultsLimit: urls.length,
            memory: 512,
        });

        const datasetRes = await this.client.dataset(run.defaultDatasetId).listItems();
        return datasetRes.items.map(i => this.normalizePostDetailsItem(i));
    }

    /** Метод для запуска скрейпинга деталей аккаунта */
    async runAccountDetailsScraper(urls: string[]): Promise<InstagramAccountDetailsItem[]> {
        const run = await this.client.actor("apify/instagram-scraper").call({
            directUrls: urls,
            resultsLimit: urls.length,

        });

        const datasetRes = await this.client.dataset(run.defaultDatasetId).listItems();
        return datasetRes.items.map(i => this.normalizeAccountDetailsItem(i));
    }

    /** Метод для нормализации возвращаемых данных поста */
    normalizePostDetailsItem(item: any): InstagramPostDetailsItem {
        return {
            url: item.inputUrl,
            likes: item.likesCount ?? 0,
            views: item.videoPlayCount ?? item.videoViewCount ?? 0,
        };
    }

    /** Метод для нормализации возвращаемых данных аккаунта */
    normalizeAccountDetailsItem(item: any): InstagramAccountDetailsItem {
        return {
            username: '',
            logoUrl: '',
            followers: 0,
        }
    }
}