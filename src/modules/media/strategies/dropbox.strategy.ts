import { Injectable } from '@nestjs/common';
import pLimit = require('p-limit');
import { MediaStrategy, ResolveMode } from './media.strategy';
import { detectDropboxLinkKind, DropboxService } from '../../../integrations/dropbox/dropbox';
import { ResolvedMediaDto } from '../dto/resolved-media.dto';
import { MediaKindEnum, MediaProviderEnum } from '../../../common/types/file/file.types';
import {
    CampaignContentItem,
    CampaignContentMediaCache,
    CampaignContentMediaItem,
} from '../../../database/schemas/campaign/campaign.schema';

type CacheItem = { fileId: string; name: string };

@Injectable()
export class DropboxMediaStrategy implements MediaStrategy {
    private readonly limit = pLimit(5);
    private readonly folderCacheTtlMs = 24 * 60 * 60 * 1000;
    private readonly previewFirstN = 8;

    constructor(private readonly dropbox: DropboxService) {}

    canHandle(mainLink: string): boolean {
        const kind = detectDropboxLinkKind(mainLink);
        return kind === 'file' || kind === 'folder';
    }

    async resolve(
        contentItem: CampaignContentItem,
        mode: ResolveMode = 'read',
    ): Promise<{ resolved: ResolvedMediaDto; mediaCachePatch?: CampaignContentMediaCache }> {
        const kind = detectDropboxLinkKind(contentItem.mainLink);

        if (kind === 'folder') {
            const now = new Date();
            const cache = contentItem.mediaCache;

            const isCacheFresh =
                !!cache?.cachedAt &&
                now.getTime() - new Date(cache.cachedAt).getTime() < this.folderCacheTtlMs;

            let items: CacheItem[] | undefined = (cache?.items as any) ?? undefined;

            let mediaCachePatch: CampaignContentMediaCache | undefined;

            if (!isCacheFresh || !items?.length) {
                const videos = await this.dropbox.listVideosFromSharedFolder(contentItem.mainLink, {
                    extensions: ['.mp4', '.mov', '.m4v', '.webm'],
                    maxItems: 500,
                    recursive: false,
                });

                items = videos.map((v) => ({ fileId: v.id, name: v.name }));

                mediaCachePatch = {
                    provider: MediaProviderEnum.dropbox,
                    kind: MediaKindEnum.folder,
                    items: items as unknown as CampaignContentMediaItem[],
                    cachedAt: now,
                } as any;

                if (mode === 'create') {
                    return {
                        resolved: {
                            provider: MediaProviderEnum.dropbox,
                            kind: MediaKindEnum.folder,
                            items: [],
                            expiresInSec: 4 * 60 * 60,
                        },
                        mediaCachePatch,
                    };
                }
            } else if (mode === 'create') {
                return {
                    resolved: {
                        provider: MediaProviderEnum.dropbox,
                        kind: MediaKindEnum.folder,
                        items: [],
                        expiresInSec: 4 * 60 * 60,
                    },
                };
            }

            const resolvedItems = await this.buildResolvedItems(items ?? []);

            return {
                resolved: {
                    provider: MediaProviderEnum.dropbox,
                    kind: MediaKindEnum.folder,
                    items: resolvedItems,
                    expiresInSec: 4 * 60 * 60,
                },
                ...(mediaCachePatch ? { mediaCachePatch } : {}),
            };
        }

        if (kind === 'file') {
            if (mode === 'create') {
                return {
                    resolved: {
                        provider: MediaProviderEnum.dropbox,
                        kind: MediaKindEnum.file,
                        items: [],
                        expiresInSec: 4 * 60 * 60,
                    },
                };
            }

            const { videoUrl, fileId, name } =
                await this.dropbox.getPlayableTempLinkFromSharedFileLink(contentItem.mainLink);

            const previewUrl = fileId
                ? await this.dropbox.tryGetPosterBase64ById(fileId, { sizeTag: 'w256h256' })
                : null;

            return {
                resolved: {
                    provider: MediaProviderEnum.dropbox,
                    kind: MediaKindEnum.file,
                    items: [{ fileId, name, videoUrl, previewUrl }],
                    expiresInSec: 4 * 60 * 60,
                },
            };
        }

        if (mode === 'create') {
            return {
                resolved: {
                    provider: MediaProviderEnum.direct,
                    kind: MediaKindEnum.file,
                    items: [],
                },
            };
        }

        return {
            resolved: {
                provider: MediaProviderEnum.direct,
                kind: MediaKindEnum.file,
                items: [{ videoUrl: contentItem.mainLink, previewUrl: null }],
            },
        };
    }

    private async buildResolvedItems(items: CacheItem[]) {
        return Promise.all(
            items.map((i, idx) =>
                this.limit(async () => {
                    const videoUrl = await this.dropbox.getPlayableTempLinkById(i.fileId);
                    const previewUrl =
                        idx < this.previewFirstN
                            ? await this.dropbox.tryGetPosterBase64ById(i.fileId, { sizeTag: 'w256h256' })
                            : null;

                    return { fileId: i.fileId, name: i.name, videoUrl, previewUrl };
                }),
            ),
        );
    }
}
