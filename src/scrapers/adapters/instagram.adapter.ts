import {ScraperAdapter} from "./scraper.adapter";
import {ApifyClient} from "apify-client";
import {InstagramAccountDetailsItem, InstagramPostDetailsItem} from "../types/scraper-post-details.types";
import {DropboxService} from 'src/services/Dropbox.service';
import axios from "axios";
import {Logger} from "@nestjs/common";
import {Types} from "mongoose";

export class InstagramAdapter implements ScraperAdapter<InstagramPostDetailsItem> {
    private readonly logger = new Logger();
    private client: ApifyClient;
    private dropboxService: DropboxService;

    constructor() {
        this.client = new ApifyClient({token: process.env.APIFY_TOKEN});
        this.dropboxService = new DropboxService();
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
        const run = await this.client.actor("apify/instagram-profile-scraper").call({
            usernames: urls,
            resultsLimit: urls.length,
            memory: 1024,
        });

        const datasetRes = await this.client.dataset(run.defaultDatasetId).listItems();

        return await Promise.all(
            datasetRes.items.map(i => this.normalizeAccountDetailsItem(i))
        );
    }

    /** Метод для нормализации возвращаемых данных поста */
    normalizePostDetailsItem(item: any): InstagramPostDetailsItem {
        return {
            url: item.inputUrl,
            likes: item.likesCount ?? 0,
            views: item.videoPlayCount ?? item.videoViewCount ?? 0,
            commentsCount: item.commentsCount ?? 0,
            latestComments: item.latestComments?.map(i => ({
                _id: new Types.ObjectId(),
                ownerUsername: i.ownerUsername,
                text: i.text,
                creationDate: i.timestamp ? new Date(i.timestamp) : undefined,
            }))
        };
    }

    /** Метод для нормализации возвращаемых данных аккаунта */
    async normalizeAccountDetailsItem(item: any): Promise<InstagramAccountDetailsItem> {
        let logoUrl: string = '';

        const engagementRate = this.calculateEngagementRate({
            accountUrl: item.inputUrl,
            username: item.username,
            followersNumber: item.followersCount ?? undefined,
            latestPosts: item.latestPosts,
            latestIgtvVideos: item.latestIgtvVideos
        })

        const averageViews = this.calculateAverageViews({
            accountUrl: item.inputUrl,
            username: item.username,
            latestIgtvVideos: item.latestIgtvVideos
        })


        /** Вспомогательная функция для скачивания изображения с retry */
        const fetchImage = async (url: string, retries = 3): Promise<Buffer | null> => {
            for (let i = 0; i < retries; i++) {
                try {
                    const res = await axios.get(url, {
                        responseType: 'arraybuffer',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                            'Referer': 'https://www.instagram.com/',
                        },
                    });
                    return Buffer.from(res.data);
                } catch (err: any) {
                    console.warn(`Попытка ${i + 1} скачать фото ${item.username} не удалась: ${err.message}`);
                    const delay = Math.pow(2, i) * 1000;
                    await new Promise(r => setTimeout(r, delay));
                }
            }
            return null;
        };

        /** Вспомогательная функция для загрузки в Dropbox с обработкой 429 + экспоненциальный backoff */
        const uploadWithRetry = async (buffer: Buffer, fileName: string, retries = 5): Promise<string | null> => {
            for (let i = 0; i < retries; i++) {
                try {
                    return await this.dropboxService.uploadFile(buffer, fileName);
                } catch (err: any) {
                    if (err.status === 429) {
                        const retryAfter = err.error?.error?.retry_after
                            ? err.error.error.retry_after * 1000
                            : Math.pow(2, i) * 1000;

                        console.warn(
                            `Dropbox 429 (rate limit) при загрузке ${fileName}. Ждём ${retryAfter}мс перед повтором (попытка ${i + 1}/${retries})`
                        );
                        await new Promise(r => setTimeout(r, retryAfter));
                    } else {
                        console.warn(`Ошибка загрузки файла ${fileName}: ${err.message}`);
                        break;
                    }
                }
            }
            return null;
        };

        const urls = [item.profilePicUrlHD, item.profilePicUrl].filter(Boolean);
        for (const url of urls) {
            const buffer = await fetchImage(url);
            if (!buffer) continue;

            let extension = '.jpg';
            try {
                const headRes = await axios.head(url);
                const contentType = headRes.headers['content-type'] || 'image/jpeg';
                if (contentType.includes('png')) extension = '.png';
                else if (contentType.includes('webp')) extension = '.webp';
                else if (contentType.includes('jpeg')) extension = '.jpeg';
            } catch {
            }

            const fileName = `${item.username}_avatar_${Date.now()}${extension}`;
            const uploadedUrl = await uploadWithRetry(buffer, fileName);
            if (uploadedUrl) {
                logoUrl = uploadedUrl;
                break;
            }
        }

        return {
            accountUrl: item.inputUrl,
            username: item.username,
            logoUrl: logoUrl ?? '',
            followers: item.followersCount ?? 0,
            engagementRate: engagementRate,
            averageViews: averageViews,
        };
    }

    /** Метод расчёта engagement rate */
    calculateEngagementRate(
        item: {
            accountUrl: string;
            username: string;
            followersNumber: number | undefined;
            latestPosts: any[];
            latestIgtvVideos: any[];
        }
    ): number | undefined {
        try {
            const maxPosts = 5;
            const maxTotal = 10;

            const posts = item.latestPosts.slice().reverse().slice(0, maxPosts);

            const remainingSlots = maxTotal - posts.length;

            const igtv = item.latestIgtvVideos.slice().reverse().slice(0, Math.min(maxPosts, remainingSlots));

            const dataForCalculating = [...posts, ...igtv];

            const totalEngagement = dataForCalculating.reduce((sum, post) => {
                const likes = post.likesCount ?? 0;
                const comments = post.commentsCount ?? 0;
                return sum + likes + comments;
            }, 0);

            return item.followersNumber
                ? parseFloat(((totalEngagement / item.followersNumber) * 100).toFixed(2))
                : undefined;
        } catch (err: any) {
            this.logger.error(
                `Error calculating engagement rate for instagram account ${item.username}: ${err.message}`
            );
            return undefined;
        }
    }

    /** Метод расчёта average views */
    calculateAverageViews(item: {
        accountUrl: string;
        username: string;
        latestIgtvVideos: any[];
    }): number | undefined {
        if (!item.latestIgtvVideos?.length) return undefined;

        try {
            const totalViews = item.latestIgtvVideos.reduce((sum, post) => {
                const views = post.videoViewCount ?? 0;
                return sum + views;
            }, 0);

            return Math.round(totalViews / item.latestIgtvVideos.length);
        } catch (err: any) {
            this.logger.error(
                `Error calculating average views for instagram account ${item.username}: ${err.message}`
            );
            return undefined;
        }
    }
}