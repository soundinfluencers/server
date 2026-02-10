import { CampaignContentItem } from '../../../database/schemas/campaign/campaign.schema';
import {GetCampaignPreviewItem} from "../dto/resolved-media.dto";

export type ResolveMode = 'create' | 'read';

export type ThumbSizeTag =
    | 'w32h32'
    | 'w64h64'
    | 'w128h128'
    | 'w256h256'
    | 'w480h320'
    | 'w640h480'
    | 'w960h640'
    | 'w1024h768'
    | 'w2048h1536';

export interface MediaStrategy {
    canHandle(mainLink: string): boolean;

    getPreviewsBatch(params: {
        mainLinkHint?: string;
        paths: string[];
        sizeTag?: ThumbSizeTag;
    }): Promise<Array<{ path: string; previewUrl: string | null }>>;

    getPreviewJpeg(params: GetCampaignPreviewItem): Promise<Buffer | null>;

    getVideoUrl(params: { pathLower?: string; url?: string; mainLinkHint?: string }): Promise<string>;

    resolve(
        contentItem: CampaignContentItem,
        mode?: ResolveMode,
    ): Promise<{
        resolved?: any;
        mediaCachePatch?: any;
    }>;
}
