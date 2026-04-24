import {IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, ValidateNested} from "class-validator";
import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {SocialMediaEnum} from "../../../../common/types/social-media.types";
import {
    PaymentHistoryAdminOverrideStatusEnum,
    PaymentHistoryEffectiveStatusEnum,
    PaymentHistorySystemStatusEnum
} from "../../../../common/types/history.types";
import {Type} from "class-transformer";

// DTO with query for fetching payments history matrix
export class GetAdminPaymentsHistoryMatrixQuery {
    @ApiPropertyOptional({ type: String })
    @IsOptional()
    @IsString()
    campaignsCursor?: string;

    @ApiPropertyOptional({ type: Number })
    @Type(() => Number)
    @IsOptional()
    @IsNumber()
    campaignsTake?: number;

    @ApiPropertyOptional({ type: String })
    @IsOptional()
    @IsString()
    accountsCursor?: string;

    @ApiPropertyOptional({ type: Number })
    @Type(() => Number)
    @IsOptional()
    @IsNumber()
    accountsTake?: number;

    @ApiPropertyOptional({ type: String })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ type: String, enum: [...Object.values(SocialMediaEnum), 'multipromo'] })
    @IsOptional()
    @IsEnum([...Object.values(SocialMediaEnum), 'multipromo'])
    socialMedia?: SocialMediaEnum | 'multipromo';

    @ApiPropertyOptional({ type: String, enum: PaymentHistoryEffectiveStatusEnum })
    @IsOptional()
    @IsEnum(PaymentHistoryEffectiveStatusEnum)
    effectiveStatus?: PaymentHistoryEffectiveStatusEnum;
}

export class AdminPaymentsHistoryCampaignDto {
    @ApiProperty()
    @IsMongoId()
    campaignId: string;

    @ApiProperty()
    @IsString()
    campaignName: string;

    @ApiProperty()
    @IsDateString()
    campaignCreatedAt: string;

    @ApiProperty()
    @IsString()
    campaignStatus: string;
}

export class AdminPaymentsHistoryAccountDto {
    @ApiProperty()
    @IsMongoId()
    accountId: string;

    @ApiProperty()
    @IsMongoId()
    influencerId: string;

    @ApiProperty()
    @IsString()
    username: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    logoUrl?: string;
}

export class AdminPaymentsHistoryCellDto {
    @ApiProperty()
    @IsMongoId()
    campaignId: string;

    @ApiProperty()
    @IsMongoId()
    accountId: string;

    @ApiProperty({ enum: PaymentHistoryEffectiveStatusEnum })
    @IsEnum(PaymentHistoryEffectiveStatusEnum)
    effectiveStatus: PaymentHistoryEffectiveStatusEnum;

    @ApiProperty({ enum: PaymentHistorySystemStatusEnum })
    @IsEnum(PaymentHistorySystemStatusEnum)
    systemStatus: PaymentHistorySystemStatusEnum;

    @ApiPropertyOptional({ enum: PaymentHistoryAdminOverrideStatusEnum })
    @IsOptional()
    @IsEnum(PaymentHistoryAdminOverrideStatusEnum)
    adminOverrideStatus?: PaymentHistoryAdminOverrideStatusEnum;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    label?: string;
}

export class AdminPaymentsHistoryMatrixMetaDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    campaignsNextCursor?: string | null;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    accountsNextCursor?: string | null;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    campaignsCount?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    accountsCount?: number;
}

// DTO with payments history matrix response (cursor paginated)
export class AdminPaymentsHistoryMatrixDto {
    @ApiProperty({ type: () => [AdminPaymentsHistoryCampaignDto] })
    @Type(() => AdminPaymentsHistoryCampaignDto)
    @ValidateNested({ each: true })
    campaigns: AdminPaymentsHistoryCampaignDto[];

    @ApiProperty({ type: () => [AdminPaymentsHistoryAccountDto] })
    @Type(() => AdminPaymentsHistoryAccountDto)
    @ValidateNested({ each: true })
    accounts: AdminPaymentsHistoryAccountDto[];

    @ApiProperty({ type: () => [AdminPaymentsHistoryCellDto] })
    @Type(() => AdminPaymentsHistoryCellDto)
    @ValidateNested({ each: true })
    cells: AdminPaymentsHistoryCellDto[];

    @ApiProperty({ type: () => AdminPaymentsHistoryMatrixMetaDto })
    @Type(() => AdminPaymentsHistoryMatrixMetaDto)
    @ValidateNested()
    meta: AdminPaymentsHistoryMatrixMetaDto;
}