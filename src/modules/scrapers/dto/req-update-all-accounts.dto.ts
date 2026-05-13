import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

    refreshInitiatorId: string;

    refreshSessionId?: string;

    @ApiPropertyOptional({
        description: 'Frontend-generated tab correlation key stored in sessionStorage.',
    })
    @IsOptional()
    @IsString()
    clientId?: string;
}
