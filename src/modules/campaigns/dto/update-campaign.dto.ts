import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {
    ArrayNotEmpty,
    IsArray,
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateNested
} from "class-validator";
import {Type} from "class-transformer";
import {CampaignContentItemDto, SelectInfluencerDto} from "./create-campaign.dto";
import {CurrencyCode} from "../../../common/types/finance.types";
import {SocialMediaEnum} from "../../../common/types/social-media.types";

// dto for requesting campaign update
export class UpdateCampaignDto {
    campaignId: string;
    optionIndex?: number;

    @ApiPropertyOptional({type: String})
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    campaignName?: string;

    @ApiPropertyOptional({type: () => [SelectInfluencerDto]})
    @IsOptional()
    @Type(() => SelectInfluencerDto)
    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    addedAccounts?: SelectInfluencerDto[];

    @ApiPropertyOptional({type: () => [CampaignContentItemDto]})
    @IsOptional()
    @Type(() => CampaignContentItemDto)
    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    campaignContent?: CampaignContentItemDto[];
}

// dto for updating campaign from admin side
export class AdminUpdateCampaignDto extends UpdateCampaignDto {
    @ApiPropertyOptional({type: Boolean})
    @IsOptional()
    @IsBoolean()
    isCpmAndResultHidden?: boolean;

    @ApiPropertyOptional({type: Boolean})
    @IsOptional()
    @IsBoolean()
    isPriceHidden?: boolean;

    @ApiPropertyOptional({type: String, enum: CurrencyCode})
    @IsOptional()
    @IsEnum(CurrencyCode)
    displayCurrency?: CurrencyCode;
}