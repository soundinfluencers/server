import { ApifyClient } from 'apify-client';
import { ScraperAdapter } from './scraper.adapter';
import {
  TikTokAccountDetailsItem,
  TikTokPostDetailsItem,
} from '../types/scraper-post-details.types';
import { Logger } from '@nestjs/common';
import { cleanAccountUrl } from '../../../common/utils/socialMedia';
import DropboxService from '../../../integrations/dropbox/dropbox';
import * as crypto from 'crypto';

type RawTikTokAccount = {
  accountUrl: string | undefined;
  username: string | undefined;
  logoUrl: string | undefined;
  followers: number | undefined;
  videosData:
    | {
        views: number;
        likes: number;
        comments: number;
        shares: number;
        saves: number;
      }[]
    | undefined;
};

export class TikTokAdapter implements ScraperAdapter<TikTokPostDetailsItem> {
  private readonly logger = new Logger(TikTokAdapter.name);
  private client: ApifyClient;
  private readonly dropboxService: DropboxService;

  constructor() {
    this.client = new ApifyClient({ token: process.env.APIFY_TOKEN });
    this.dropboxService = new DropboxService();
  }

  async runPostDetailsScraper(urls: string[]): Promise<TikTokPostDetailsItem[]> {
    const run = await this.client.actor('clockworks/tiktok-scraper').call({
      postURLs: urls,
      resultsLimit: urls.length,
      memory: 1024,
    });

    const datasetRes = await this.client.dataset(run.defaultDatasetId).listItems();
    return datasetRes.items.map((i) => this.normalizePostDetailsItem(i));
  }

  async runAccountDetailsScraper(urls: string[]): Promise<TikTokAccountDetailsItem[]> {
    const run = await this.client.actor('clockworks/tiktok-profile-scraper').call({
      profiles: urls,
      shouldDownloadCovers: false,
      shouldDownloadSlideshowImages: false,
      shouldDownloadSubtitles: false,
      shouldDownloadVideos: false,
      resultsPerPage: 13,
    });

    const datasetRes: any = await this.client.dataset(run.defaultDatasetId).listItems();

    const accounts: RawTikTokAccount[] = [];

    for (const item of datasetRes.items) {
      if (!item?.authorMeta?.profileUrl || item?.isPinned) continue;

      const cleanedAccountUrl: string = cleanAccountUrl(item?.authorMeta?.profileUrl, 'tiktok');

      const index: number = accounts.findIndex((acc) => acc?.accountUrl === cleanedAccountUrl);

      const videoData = {
        views: item.playCount ?? 0,
        likes: item.diggCount ?? 0,
        comments: item.commentCount ?? 0,
        shares: item.shareCount ?? 0,
        saves: item.collectCount ?? 0,
      };

      if (index !== -1) {
        accounts[index].videosData?.push(videoData);
      } else {
        accounts.push({
          accountUrl: cleanedAccountUrl ?? undefined,
          username: item?.authorMeta?.name ?? undefined,
          logoUrl: item?.authorMeta?.avatar ?? undefined,
          followers: item.authorMeta?.fans ?? undefined,
          videosData: [videoData],
        });
      }
    }

    const accountsWithStoredAvatars = await this.processAvatarUploads(accounts);

    return accountsWithStoredAvatars.map((i) => this.normalizeAccountDetailsItem(i));
  }

  normalizePostDetailsItem(item: any): TikTokPostDetailsItem {
    return {
      url: item.submittedVideoUrl,
      likes: item.diggCount ?? 0,
      views: item.playCount ?? 0,
      commentsCount: item.commentCount ?? 0,
      shares: item.shareCount ?? 0,
      saves: item.collectCount ?? 0,
    };
  }

  normalizeAccountDetailsItem(item: RawTikTokAccount): TikTokAccountDetailsItem {
    const engagementRate: number | undefined = this.calculateEngagementRate({
      username: item.username ?? '',
      followersNumber: item.followers,
      videosData: item.videosData,
    });

    const averageViews: number | undefined = this.calculateAverageViews({
      username: item.username ?? '',
      videosData: item.videosData,
    });

    return {
      accountUrl: item.accountUrl ?? '',
      username: item.username ?? '',
      logoUrl: item.logoUrl ?? '',
      followers: item.followers ?? 0,
      engagementRate,
      averageViews,
    };
  }

  calculateEngagementRate(item: {
    username: string;
    followersNumber: number | undefined;
    videosData:
      | {
          views: number;
          likes: number;
          comments: number;
          shares: number;
        }[]
      | undefined;
  }): number | undefined {
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
        `Error calculating engagement rate for tiktok account ${item.username}: ${err.message}`,
      );
      return undefined;
    }
  }

  calculateAverageViews(item: {
    username: string;
    videosData:
      | {
          views: number;
          likes: number;
          comments: number;
          shares: number;
        }[]
      | undefined;
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
        `Error calculating average views for tiktok account ${item.username}: ${err.message}`,
      );
      return undefined;
    }
  }

  private async processAvatarUploads(accounts: RawTikTokAccount[]): Promise<RawTikTokAccount[]> {
    const uniqueAvatarMap = new Map<string, { username?: string }>();

    for (const account of accounts) {
      if (!account.logoUrl) continue;
      if (!uniqueAvatarMap.has(account.logoUrl)) {
        uniqueAvatarMap.set(account.logoUrl, { username: account.username });
      }
    }

    const avatarJobs = Array.from(uniqueAvatarMap.entries()).map(([logoUrl, meta]) => ({
      logoUrl,
      username: meta.username ?? 'unknown',
    }));

    const uploadedMap = new Map<string, string>();

    const firstPassResults = await this.processInBatches(avatarJobs, 5, async (job) => {
      const uploadedUrl = await this.handleSingleAvatar(job.logoUrl, job.username);
      return { ...job, uploadedUrl };
    });

    const retryQueue = firstPassResults.filter((x) => !x.uploadedUrl);

    if (retryQueue.length) {
      this.logger.warn(`Retrying ${retryQueue.length} TikTok avatar uploads after first pass`);

      await this.sleep(2000);

      const secondPassResults = await this.processInBatches(retryQueue, 2, async (job) => {
        const uploadedUrl = await this.handleSingleAvatar(job.logoUrl, job.username);
        return { ...job, uploadedUrl };
      });

      for (const result of secondPassResults) {
        if (result.uploadedUrl) {
          uploadedMap.set(result.logoUrl, result.uploadedUrl);
        }
      }
    }

    for (const result of firstPassResults) {
      if (result.uploadedUrl) {
        uploadedMap.set(result.logoUrl, result.uploadedUrl);
      }
    }

    return accounts.map((account) => {
      if (!account.logoUrl) return account;

      const storedLogoUrl = uploadedMap.get(account.logoUrl);
      return {
        ...account,
        logoUrl: storedLogoUrl ?? account.logoUrl,
      };
    });
  }

  private async handleSingleAvatar(avatarUrl: string, username: string): Promise<string | null> {
    try {
      const buffer = await this.runWithRetry(
        () => this.downloadAvatarBuffer(avatarUrl),
        3,
        1200,
        `download avatar for ${username}`,
      );

      if (!buffer) return null;

      const uploadedUrl = await this.runWithRetry(
        () => this.uploadAvatarToDropbox(buffer, username, avatarUrl),
        4,
        2000,
        `upload avatar to dropbox for ${username}`,
      );

      return uploadedUrl;
    } catch (err: any) {
      this.logger.warn(
        `Failed to persist TikTok avatar for ${username}. Using original url. ${err.message}`,
      );
      return null;
    }
  }

  private async downloadAvatarBuffer(url: string): Promise<Buffer | null> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Avatar download failed with status ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err: any) {
      this.logger.warn(`Error downloading avatar ${url}: ${err.message}`);
      return null;
    }
  }

  private async uploadAvatarToDropbox(
    fileBuffer: Buffer,
    username: string,
    originalUrl: string,
  ): Promise<string | null> {
    try {
      const ext = this.getImageExtension(originalUrl);
      const hash = crypto.createHash('md5').update(originalUrl).digest('hex').slice(0, 10);

      const safeUsername = (username || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 50);

      const fileName = `tiktok-avatar-${safeUsername}-${hash}.${ext}`;

      return await this.dropboxService.uploadFile(fileBuffer, fileName);
    } catch (err: any) {
      this.logger.warn(`Error uploading avatar to Dropbox for ${username}: ${err.message}`);
      return null;
    }
  }

  private getImageExtension(url: string): string {
    const lower = url.toLowerCase();

    if (lower.includes('.png')) return 'png';
    if (lower.includes('.webp')) return 'webp';
    if (lower.includes('.jpeg')) return 'jpeg';
    if (lower.includes('.jpg')) return 'jpg';

    return 'jpg';
  }

  private async processInBatches<T, R>(
    items: T[],
    batchSize: number,
    handler: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((item) => handler(item)));
      results.push(...batchResults);

      if (i + batchSize < items.length) {
        await this.sleep(700);
      }
    }

    return results;
  }

  private async runWithRetry<T>(
    fn: () => Promise<T>,
    retries = 3,
    baseDelayMs = 1000,
    context = 'operation',
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;

        const message = err?.message || '';
        const isTooManyRequests =
          message.includes('429') ||
          message.toLowerCase().includes('too many requests') ||
          err?.status === 429;

        const isLastAttempt = attempt === retries;

        this.logger.warn(`${context} failed on attempt ${attempt}/${retries}: ${message}`);

        if (isLastAttempt) break;

        const delay = isTooManyRequests
          ? baseDelayMs * Math.pow(2, attempt)
          : baseDelayMs * attempt;

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
