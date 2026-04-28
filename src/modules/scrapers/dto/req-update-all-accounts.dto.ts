import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
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
}
