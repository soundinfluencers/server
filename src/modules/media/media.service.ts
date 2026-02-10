import {MediaStrategyFactory} from "./media.factory";
import {Injectable} from "@nestjs/common";
import {CampaignContentItem} from "../../database/schemas/campaign/campaign.schema";
import {CampaignPreviewItemDto, GetCampaignContentVideoUrl} from "./dto/resolved-media.dto";
import {MediaKindEnum, MediaProviderEnum} from "../../common/types/file/file.types";
import {detectDropboxLinkKind} from "../../integrations/dropbox/dropbox";
import {ThumbSizeTag} from "./strategies/media.strategy";

@Injectable()
export class MediaService {
    constructor(private readonly factory: MediaStrategyFactory) {}

    async getCampaignPreviews(
        contentItems: CampaignContentItem[],
        opts?: { sizeTag?: ThumbSizeTag; maxPerItem?: number },
    ): Promise<CampaignPreviewItemDto[]> {
        const sizeTag: ThumbSizeTag = opts?.sizeTag ?? 'w256h256';
        const maxPerItem = opts?.maxPerItem ?? 1000;

        return Promise.all(
            contentItems.map(async (ci): Promise<CampaignPreviewItemDto> => {
                const strategy = this.factory.getStrategy(ci.mainLink);

                const cachedItems = (ci.mediaCache?.items ?? []).slice(0, maxPerItem);

                if (
                    ci.mediaCache?.provider === MediaProviderEnum.dropbox &&
                    ci.mediaCache?.kind === MediaKindEnum.folder &&
                    cachedItems.length
                ) {
                    const paths = cachedItems
                        .map((x) => x.pathLower)
                        .filter((p): p is string => typeof p === 'string' && p.length > 0);

                    const previews = await strategy.getPreviewsBatch({ paths, sizeTag });

                    const previewMap = new Map<string, string | null>(
                        previews.map((p) => [p.path, p.previewUrl]),
                    );

                    return {
                        contentItemId: String(ci._id),
                        mainLink: ci.mainLink,
                        kind: 'folder',
                        previews: cachedItems.map((x) => ({
                            fileId: x.fileId,
                            name: x.name,
                            pathLower: x.pathLower,
                            previewUrl: x.pathLower ? (previewMap.get(x.pathLower) ?? null) : null,
                        })),
                    };
                }

                return {
                    contentItemId: String(ci._id),
                    mainLink: ci.mainLink,
                    kind: 'direct',
                    previews: [],
                };
            }),
        );
    }

    // returns jpeg image with campaign content video preview
    async getCampaignPreviewJpeg(params: {
        mainLinkHint: string;
        pathLower?: string;
        fileId?: string;
        sizeTag?: ThumbSizeTag;
    }): Promise<Buffer | null> {
        const strategy = this.factory.getStrategy(params.mainLinkHint);

        return strategy.getPreviewJpeg({
            mainLinkHint: params.mainLinkHint,
            pathLower: params.pathLower,
            fileId: params.fileId,
            sizeTag: params.sizeTag,
        });
    }

    async getVideoRedirectUrl(params: GetCampaignContentVideoUrl) {
        const strategy = params.pathLower
            ? this.factory.getDropbox()
            : this.factory.getStrategy(params.mainLinkHint ?? params.url ?? '');

        const videoUrl = await (strategy as any).getVideoUrl({
            pathLower: params.pathLower,
            url: params.url,
        });

        return { videoUrl };
    }

    async applyMediaCacheForCreate(contentItems: CampaignContentItem[]): Promise<CampaignContentItem[]> {
        const out = await Promise.all(
            contentItems.map(async (ci: any) => {
                const strategy = this.factory.getStrategy(ci.mainLink);
                const { mediaCachePatch } = await strategy.resolve(ci, 'create');

                return mediaCachePatch ? { ...ci, mediaCache: mediaCachePatch } : ci;
            }),
        );

        return out;
    }
}