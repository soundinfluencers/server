import { MediaProviderEnum, MediaKindEnum } from '../../../common/types/file/file.types';

export type ResolvedMediaItemDto = {
    fileId?: string;
    name?: string;
    videoUrl: string;
    previewUrl?: string | null;
};

export type ResolvedMediaDto = {
    provider: MediaProviderEnum;
    kind: MediaKindEnum;
    items: ResolvedMediaItemDto[];
    expiresInSec?: number;
};
