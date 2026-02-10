import { MediaProviderEnum, MediaKindEnum } from '../../../common/types/file/file.types';
import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {IsEnum, IsNotEmpty, IsOptional, IsString} from "class-validator";
import {ThumbSizeTag} from "../strategies/media.strategy";
import {Type} from "class-transformer";

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

// dto for returning campaign previews for campaign item
export class CampaignPreviewItemDto {
    @ApiProperty()
    contentItemId: string;

    @ApiProperty({enum: MediaProviderEnum})
    provider: MediaProviderEnum;

    @ApiProperty()
    mainLink: string;

    @ApiProperty({enum: ['file', 'folder', 'direct', 'unknown']})
    kind: 'folder' | 'file' | 'direct';

    @ApiProperty()
    previews: Array<{
        fileId?: string;
        pathLower?: string;
        name?: string;
        previewUrl: string | null;
    }>;
}

// dto for getting campaign content item video url
export class GetCampaignContentVideoUrl {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    pathLower?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    url?: string;

    @ApiProperty({enum: MediaProviderEnum})
    @IsEnum(MediaProviderEnum)
    provider: MediaProviderEnum;
}

// dto for getting video preview
export class GetCampaignPreviewItem {
    @ApiProperty({enum: MediaProviderEnum})
    @IsEnum(MediaProviderEnum)
    provider: MediaProviderEnum;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    pathLower?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    fileId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    sizeTag?: ThumbSizeTag;
}