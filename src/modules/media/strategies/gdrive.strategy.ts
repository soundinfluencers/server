import { BadRequestException, Injectable } from '@nestjs/common';
import pLimit = require('p-limit');
import { MediaStrategy, ResolveMode, ThumbSizeTag } from './media.strategy';
import GoogleDriveService, {
  detectGdriveLinkKind,
  extractGdriveId,
} from '../../../integrations/gdrive/gdrive';
import { GetCampaignPreviewItem, ResolvedMediaDto } from '../dto/resolved-media.dto';
import { MediaKindEnum, MediaProviderEnum } from '../../../common/types/file/file.types';
import {
  CampaignContentItem,
  CampaignContentMediaCache,
  CampaignContentMediaItem,
} from '../../../database/schemas/campaign/campaign.schema';

type CacheItem = { fileId: string; name: string; pathLower: string };

@Injectable()
export class GdriveMediaStrategy implements MediaStrategy {
  private readonly limit = pLimit(5);
  private readonly folderCacheTtlMs = 24 * 60 * 60 * 1000;
  private readonly previewFirstN = 50;

  constructor(private readonly gdrive: GoogleDriveService) {}

  canHandle(mainLink: string): boolean {
    const kind = detectGdriveLinkKind(mainLink);
    return kind === 'file' || kind === 'folder';
  }

  async getPreviewsBatch(params: { paths: string[]; sizeTag?: ThumbSizeTag }) {
    const sizeTag = params.sizeTag ?? 'w256h256';

    return Promise.all(
      params.paths.map((fileId) =>
        this.limit(async () => ({
          path: fileId,
          previewUrl: await this.gdrive.tryGetThumbnailBase64(fileId, sizeTag),
        })),
      ),
    );
  }

  async getPreviewJpeg(params: GetCampaignPreviewItem): Promise<Buffer | null> {
    const sizeTag = params.sizeTag ?? 'w256h256';
    const fileId = params.fileId ?? params.pathLower;
    if (!fileId) return null;
    return this.gdrive.tryGetThumbnailJpeg(fileId, sizeTag);
  }

  async getVideoUrl(params: { pathLower?: string; url?: string }): Promise<string> {
    // pathLower stores the fileId for GDrive
    if (params.pathLower) {
      return this.gdrive.getVideoStreamUrl(params.pathLower);
    }

    if (params.url) {
      const fileId = extractGdriveId(params.url);
      if (!fileId) throw new BadRequestException('Could not extract Google Drive file ID from url');
      return this.gdrive.getVideoStreamUrl(fileId);
    }

    throw new BadRequestException('pathLower (fileId) or url is required');
  }

  async resolve(
    contentItem: CampaignContentItem,
    mode: ResolveMode = 'read',
  ): Promise<{ resolved: ResolvedMediaDto; mediaCachePatch?: CampaignContentMediaCache }> {
    const kind = detectGdriveLinkKind(contentItem.mainLink);
    const resourceId = extractGdriveId(contentItem.mainLink);

    if (!resourceId) {
      return {
        resolved: {
          provider: MediaProviderEnum.gdrive,
          kind: MediaKindEnum.file,
          items: [],
        },
      };
    }

    if (kind === 'folder') {
      const emptyFolderResult = {
        resolved: {
          provider: MediaProviderEnum.gdrive,
          kind: MediaKindEnum.folder,
          items: [],
          expiresInSec: 60 * 60,
        },
      };

      if (mode === 'create' && !this.gdrive.isInitialized()) {
        return emptyFolderResult;
      }

      const now = new Date();
      const cache = contentItem.mediaCache;

      const isCacheFresh =
        !!cache?.cachedAt &&
        now.getTime() - new Date(cache.cachedAt).getTime() < this.folderCacheTtlMs;

      let items: CacheItem[] | undefined = (cache?.items as any) ?? undefined;
      let mediaCachePatch: CampaignContentMediaCache | undefined;

      if (!isCacheFresh || !items?.length || items.some((x: any) => !x.fileId)) {
        const videos = await this.gdrive.listVideosFromFolder(resourceId);

        items = videos.map((v) => ({
          fileId: v.fileId,
          name: v.name,
          pathLower: v.fileId,
        }));

        mediaCachePatch = {
          provider: MediaProviderEnum.gdrive,
          kind: MediaKindEnum.folder,
          items: items as unknown as CampaignContentMediaItem[],
          cachedAt: now,
        } as any;

        if (mode === 'create') {
          return { ...emptyFolderResult, mediaCachePatch };
        }
      } else if (mode === 'create') {
        return emptyFolderResult;
      }

      const resolvedItems = await this.buildResolvedItems(items ?? []);

      return {
        resolved: {
          provider: MediaProviderEnum.gdrive,
          kind: MediaKindEnum.folder,
          items: resolvedItems,
          expiresInSec: 60 * 60,
        },
        ...(mediaCachePatch ? { mediaCachePatch } : {}),
      };
    }

    if (kind === 'file') {
      if (mode === 'create') {
        return {
          resolved: {
            provider: MediaProviderEnum.gdrive,
            kind: MediaKindEnum.file,
            items: [],
            expiresInSec: 60 * 60,
          },
        };
      }

      const [info, videoUrl, previewUrl] = await Promise.all([
        this.gdrive.getFileInfo(resourceId),
        this.gdrive.getVideoStreamUrl(resourceId),
        this.gdrive.tryGetThumbnailBase64(resourceId, 'w256h256'),
      ]);

      return {
        resolved: {
          provider: MediaProviderEnum.gdrive,
          kind: MediaKindEnum.file,
          items: [
            {
              fileId: resourceId,
              name: info?.name ?? '',
              videoUrl,
              previewUrl,
              pathLower: resourceId,
            } as any,
          ],
          expiresInSec: 60 * 60,
        },
      };
    }

    return {
      resolved: {
        provider: MediaProviderEnum.gdrive,
        kind: MediaKindEnum.file,
        items: [],
      },
    };
  }

  private async buildResolvedItems(items: CacheItem[]) {
    return Promise.all(
      items.map((item, idx) =>
        this.limit(async () => {
          const videoUrl = await this.gdrive.getVideoStreamUrl(item.fileId);

          const previewUrl =
            idx < this.previewFirstN
              ? await this.gdrive.tryGetThumbnailBase64(item.fileId, 'w256h256')
              : null;

          return {
            fileId: item.fileId,
            name: item.name,
            pathLower: item.fileId,
            videoUrl,
            previewUrl,
          };
        }),
      ),
    );
  }
}
