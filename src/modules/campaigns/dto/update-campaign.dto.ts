import {ApiPropertyOptional} from "@nestjs/swagger";
import {ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested} from "class-validator";
import {Type} from "class-transformer";
import {CampaignContentItemDto, SelectInfluencerDto} from "./create-campaign.dto";

// dto for requesting campaign update
export class UpdateCampaignDto {
    campaignId: string;

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