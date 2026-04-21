import {IsEnum, IsNumber, IsOptional, IsString} from "class-validator";
import {ApiPropertyOptional} from "@nestjs/swagger";
import {SocialMediaEnum} from "../../../../common/types/social-media.types";
import {PaymentHistoryEffectiveStatusEnum} from "../../../../common/types/history.types";

// DTO with query for fetching payments history matrix
export class GetAdminPaymentsHistoryMatrixQuery {
    @ApiPropertyOptional({ type: String })
    @IsOptional()
    @IsString()
    campaignsCursor?: string;

    @ApiPropertyOptional({ type: Number })
    @IsOptional()
    @IsNumber()
    campaignsTake?: number;

    @ApiPropertyOptional({ type: String })
    @IsOptional()
    @IsString()
    accountsCursor?: string;

    @ApiPropertyOptional({ type: Number })
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

// DTO with payments history matrix response (cursor paginated)
export class AdminPaymentsHistoryMatrixDto {
    campaigns: any[];
    accounts: any[];
    cells: any[];
    meta: {
        campaignsNextCursor?: string | null;
        accountsNextCursor?: string | null;
        campaignsCount?: number;
        accountsCount?: number;
    };
}