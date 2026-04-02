import { ApiPropertyOptional, ApiHideProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import {ExactlyOneDefined} from "../../../../common/decorators/dto/exactly-one-defined.decorator";
import {CampaignAdminMetaEnum} from "../../../../common/types/client/campaign.types";

// DTO with available fields for update campaign's admin meta information
export class UpdateAdminMetaCampaignDto {
    @ApiPropertyOptional({ type: Boolean })
    @IsBoolean()
    @IsOptional()
    reportSent?: boolean;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    notes?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    affiliatePartner?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    affiliateCommission?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    affiliatePaid?: string;

    @ApiHideProperty()
    @ExactlyOneDefined<UpdateAdminMetaCampaignDto>(
        CampaignAdminMetaEnum,
        {
            message: 'You must provide exactly one admin meta field',
        },
    )
    private readonly __exactlyOneDefinedValidation?: never;
}

// DTO with result of updating campaign's admin meta information
export class UpdatedAdminMetaCampaignDto {
    @ApiPropertyOptional({type: Boolean})
    @IsBoolean()
    @IsOptional()
    reportSent?: boolean;

    @ApiPropertyOptional({type: String})
    @IsString()
    @IsOptional()
    notes?: string;

    @ApiPropertyOptional({type: String})
    @IsString()
    @IsOptional()
    affiliatePartner?: string;

    @ApiPropertyOptional({type: String})
    @IsString()
    @IsOptional()
    affiliateCommission?: string;

    @ApiPropertyOptional({type: String})
    @IsString()
    @IsOptional()
    affiliatePaid?: string;
}