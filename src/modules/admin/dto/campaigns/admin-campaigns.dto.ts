import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {SocialMediaEnum, SocialMediaType} from "../../../../common/types/social-media.types";
import {Role} from "../../../../common/types/user.types";
import {PaginatedListResponseDto} from "../../../../common/dto/responses/paginated-list-response.dto";
import {SearchListResponseDto} from "../../../../common/dto/responses/search-response.dto";
import {
    AdminCampaignStatusEnum,
    CampaignPaymentStatusEnum,
} from "../../../../common/types/client/campaign.types";
import {PaginationQueryDto} from "../../../../common/dto/requests/pagination-query.dto";
import {IsEnum, IsOptional} from "class-validator";
import {CampaignAccountDto, CampaignDetailsDto} from "../../../campaigns/dto/get-campaigns.dto";

export enum AdminCampaignsListStatusEnum {
    proposal = 'proposal',
    pending = 'pending',
    distributing = 'distributing',
    completed = 'completed',
}

export class GetAdminCampaignsListQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({ type: String, enum: AdminCampaignsListStatusEnum })
    @IsOptional()
    @IsEnum(AdminCampaignsListStatusEnum)
    status?: AdminCampaignsListStatusEnum;
}

// DTO with campaign item for admin campaigns list
export class AdminCampaignForListDto {
    @ApiProperty({ type: String })
    campaignId: string;

    @ApiProperty({ type: String, enum: [...Object.values(SocialMediaEnum), 'multipromo'] })
    socialMedia: SocialMediaType | 'multipromo';

    @ApiProperty({ type: String })
    campaignName: string;

    @ApiProperty({ type: String, enum: Role })
    creatorRole: Role;

    @ApiProperty({ type: String })
    creatorName: string;

    @ApiPropertyOptional({ type: Number })
    followers?: number;

    @ApiPropertyOptional({ type: Number })
    cost?: number; // campaignPrice

    @ApiPropertyOptional({ type: Number })
    salePrice?: number; // sum of accounts public price field

    @ApiProperty({ type: String })
    date: string;

    @ApiProperty({ type: String, enum: AdminCampaignsListStatusEnum })
    status: AdminCampaignsListStatusEnum;

    @ApiProperty({ type: String, enum: AdminCampaignStatusEnum })
    statusLabel: AdminCampaignStatusEnum;

    @ApiProperty({ type: Boolean })
    reportSent: boolean;

    @ApiPropertyOptional({ type: String, enum: CampaignPaymentStatusEnum })
    paymentStatus?: CampaignPaymentStatusEnum;

    @ApiProperty({ type: String })
    invoiceId: string;

    @ApiProperty({ type: Number })
    shortInvoiceNumber: number;

    @ApiPropertyOptional({ type: String })
    notes?: string;

    @ApiPropertyOptional({ type: String })
    affiliatePartner?: string;

    @ApiPropertyOptional({ type: String })
    affiliateCommission?: string;

    @ApiPropertyOptional({ type: String })
    affiliatePaid?: string;
}

export class AdminCampaignsListResponseDto extends PaginatedListResponseDto<AdminCampaignForListDto> {
    @ApiProperty({
        type: [AdminCampaignForListDto],
        description: 'List of campaigns',
    })
    items: AdminCampaignForListDto[];
}

export class AdminCampaignSearchResponseDto extends SearchListResponseDto<AdminCampaignForListDto> {
    @ApiProperty({
        type: [AdminCampaignForListDto],
        description: 'List of campaigns',
    })
    items: AdminCampaignForListDto[];
}

// DTO with detailed campaign's addedAccounts item for admin
export class AdminCampaignAccountDto extends CampaignAccountDto {
    @ApiPropertyOptional({ type: Number })
    cpm?: number;
}

// DTO with detailed campaign for admin
export class AdminCampaignDetailsDto extends CampaignDetailsDto {
    @ApiProperty({ type: AdminCampaignAccountDto, isArray: true })
    addedAccounts: AdminCampaignAccountDto[];

    @ApiPropertyOptional({ type: Number, isArray: true})
    existingOptions?: number[];
}
