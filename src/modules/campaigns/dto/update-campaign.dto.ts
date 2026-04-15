import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {
    ArrayNotEmpty,
    IsArray,
    IsBoolean,
    IsEnum,
    IsNotEmpty, IsNumber,
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

// dto for updating addedAccounts array in campaign from admin side
export class AdminUpdatePromoDto extends SelectInfluencerDto {
    @ApiPropertyOptional({type: String})
    @IsOptional()
    @IsString()
    postLink?: string;

    @ApiPropertyOptional({type: String})
    @IsOptional()
    @IsString()
    screenshot?: string;

    @ApiPropertyOptional({type: Number})
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    impressions?: number;

    @ApiPropertyOptional({type: Number})
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    like?: number;

    @ApiPropertyOptional({type: Number})
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    comments?: number;

    @ApiPropertyOptional({type: Number})
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    shares?: number;

    @ApiPropertyOptional({type: Number})
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    saves?: number;

    @ApiPropertyOptional({type: Number})
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    rating?: number;
}

// dto for updating campaign from admin side
export class AdminUpdateCampaignDto extends UpdateCampaignDto {
    @ApiPropertyOptional({type: () => [AdminUpdatePromoDto]})
    @IsOptional()
    @Type(() => AdminUpdatePromoDto)
    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    addedAccounts?: AdminUpdatePromoDto[];

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