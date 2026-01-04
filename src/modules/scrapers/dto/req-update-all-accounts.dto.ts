import {IsEnum, IsNotEmpty, IsString} from 'class-validator';
import {ApiProperty} from "@nestjs/swagger";
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

    @IsString({
        message: 'Invalid socket id',
    })
    @IsNotEmpty({
        message: 'Socket id cannot be empty',
    })
    @ApiProperty({
        example: '234g1h2b'
    })
    socketId: string;

    refreshInitiatorId: string;
}
