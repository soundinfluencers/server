import { BadRequestException, Injectable } from '@nestjs/common';
import { MediaStrategy, ResolveMode, ThumbSizeTag } from './media.strategy';
import { CampaignContentItem } from '../../../database/schemas/campaign/campaign.schema';

@Injectable()
export class DirectMediaStrategy implements MediaStrategy {
    canHandle(_: string): boolean {
        return true;
    }

    async getPreviewsBatch(params: {
        mainLinkHint?: string;
        paths: string[];
        sizeTag?: ThumbSizeTag;
    }): Promise<Array<{ path: string; previewUrl: string | null }>> {
        return params.paths.map((path) => ({ path, previewUrl: null }));
    }

    async getPreviewJpeg(): Promise<Buffer | null> {
        return null;
    }

    async getVideoUrl(params: { pathLower?: string; url?: string }): Promise<string> {
        if (params.url) return params.url;
        throw new BadRequestException('url is required for direct provider');
    }

    async resolve(_contentItem: CampaignContentItem, _mode: ResolveMode = 'read') {
        return { resolved: undefined };
    }
}