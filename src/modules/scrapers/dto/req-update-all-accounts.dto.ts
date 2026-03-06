import {IsEnum, IsNotEmpty, IsOptional, IsString} from 'class-validator';
import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {ScraperAvailableSocialMedias} from "../types/scraper.types";

export class ReqUpdateAllAccountsDto {
    @IsEnum(ScraperAvailableSocialMedias, {
        message: `Social media must be one of: ${Object.values(ScraperAvailableSocialMedias).join(', ')}`,
    })
    @ApiProperty({
        enum: ScraperAvailableSocialMedias,
        description: 'Available social media',
    })
    socialMedia: ScraperAvailableSocialMedias;

    @ApiPropertyOptional({
        example: '234g1h2b'
    })
    @IsOptional()
    @IsString({
        message: 'Invalid socket id',
    })
    socketId?: string;

    refreshInitiatorId: string;
}
