import {ApiPropertyOptional} from "@nestjs/swagger";
import {ArrayNotEmpty, IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested} from "class-validator";
import {Type} from "class-transformer";
import {CampaignContentItemDto, SelectInfluencerDto} from "./create-campaign.dto";

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
}