import {ApiProperty, ApiPropertyOptional, getSchemaPath} from '@nestjs/swagger';
import {
    IsDateString,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsString,
    IsUrl,
    Min,
    IsOptional, ValidateNested,
} from 'class-validator';
import {BespokeRequestCategory} from "../../../common/types/client/campaign.types";
import {Transform, Type} from "class-transformer";


// ----------- BASE CLASSES -----------


// base bespoke campaign dto
export class BaseBespokeCampaignDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    campaignGoal?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    contentLink?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(0)
    budget?: number;

    @ApiPropertyOptional({ type: String })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    targetTerritories?: string;

    @ApiPropertyOptional({ description: 'Any Extra Briefs' })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    extraBriefs?: string;
}

// artist bespoke campaign dto
export class ArtistBespokeCampaignDto extends BaseBespokeCampaignDto {}

// music bespoke campaign dto
export class MusicBespokeCampaignDto extends BaseBespokeCampaignDto {
    @ApiProperty({ description: 'Download or private link to the track' })
    @IsUrl()
    trackLink: string;

    @ApiProperty({ description: 'Release date (ISO)' })
    @IsDateString()
    releaseDate: string;

    @ApiProperty({ description: 'LinkFire / smartLink' })
    @IsUrl()
    smartLink: string;
}

// event bespoke campaign dto
export class EventBespokeCampaignDto extends BaseBespokeCampaignDto {
    @ApiProperty({ description: 'Ticket link' })
    @IsUrl()
    ticketLink: string;
}

// other bespoke campaign dto
export class OtherBespokeCampaignDto {
    @ApiProperty({ description: 'Brief' })
    @IsString()
    @IsNotEmpty()
    brief: string;
}


// ----------- REQUESTS -----------


export class CreateBespokeCampaignDto {
    @ApiProperty({ type: String, enum: BespokeRequestCategory })
    @IsEnum(BespokeRequestCategory)
    category: BespokeRequestCategory;

    @ApiProperty({
        oneOf: [
            { $ref: getSchemaPath(ArtistBespokeCampaignDto) },
            { $ref: getSchemaPath(MusicBespokeCampaignDto) },
            { $ref: getSchemaPath(EventBespokeCampaignDto) },
            { $ref: getSchemaPath(OtherBespokeCampaignDto) },
        ],
    })
    @ValidateNested()
    @Type(() => BaseBespokeCampaignDto, {
        discriminator: {
            property: 'category',
            subTypes: [
                { name: BespokeRequestCategory.artist, value: ArtistBespokeCampaignDto },
                { name: BespokeRequestCategory.music, value: MusicBespokeCampaignDto },
                { name: BespokeRequestCategory.event, value: EventBespokeCampaignDto },
                { name: BespokeRequestCategory.other, value: OtherBespokeCampaignDto },
            ],
        },
        keepDiscriminatorProperty: true,
    })
    payload:
        | ArtistBespokeCampaignDto
        | MusicBespokeCampaignDto
        | EventBespokeCampaignDto
        | OtherBespokeCampaignDto;
}


// ----------- RESPONSES -----------