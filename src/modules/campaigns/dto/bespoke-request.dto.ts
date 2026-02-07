import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import {
    IsArray,
    ArrayNotEmpty,
    IsDateString,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsString,
    IsUrl,
    Min,
    ValidateNested, IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BespokeRequestCategory } from './bespoke-request-category.enum';

export class BespokeRequestBaseDto {
    @ApiProperty({ description: 'What you’re promoting (Campaign Goal)' })
    @IsString()
    @IsNotEmpty()
    campaignGoal: string;

    @ApiProperty({ description: 'Content available' })
    @IsString()
    @IsNotEmpty()
    contentAvailable: string;

    @ApiProperty({ description: 'Your budget', example: 1000 })
    @IsNumber()
    @Min(0)
    budget: number;

    @ApiProperty({
        description: 'Target territories',
        example: ['UK', 'US'],
        type: [String],
    })
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    targetTerritories: string[];

    @ApiPropertyOptional({ description: 'Any Extra Briefs' })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    extraBriefs?: string;
}

export class ArtistBespokeRequestDto extends BespokeRequestBaseDto {
    @ApiProperty({ enum: BespokeRequestCategory, default: BespokeRequestCategory.ARTIST })
    @IsEnum(BespokeRequestCategory)
    category: BespokeRequestCategory.ARTIST;
}

export class MusicBespokeRequestDto extends BespokeRequestBaseDto {
    @ApiProperty({ enum: BespokeRequestCategory, default: BespokeRequestCategory.MUSIC })
    @IsEnum(BespokeRequestCategory)
    category: BespokeRequestCategory.MUSIC;

    @ApiProperty({ description: 'Download or private link to the track' })
    @IsUrl()
    trackLink: string;

    @ApiProperty({ description: 'Release date (ISO)' })
    @IsDateString()
    releaseDate: string;

    @ApiProperty({ description: 'Linkfire / smartlink' })
    @IsUrl()
    smartlink: string;
}

export class EventBespokeRequestDto extends BespokeRequestBaseDto {
    @ApiProperty({ enum: BespokeRequestCategory, default: BespokeRequestCategory.EVENT })
    @IsEnum(BespokeRequestCategory)
    category: BespokeRequestCategory.EVENT;

    @ApiProperty({ description: 'Ticket link' })
    @IsUrl()
    ticketLink: string;
}

export class OtherBespokeRequestDto {
    @ApiProperty({ enum: BespokeRequestCategory, default: BespokeRequestCategory.OTHER })
    @IsEnum(BespokeRequestCategory)
    category: BespokeRequestCategory.OTHER;

    @ApiProperty({ description: 'Brief' })
    @IsString()
    @IsNotEmpty()
    brief: string;
}
