import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {SocialMediaEnum, SocialMediaType} from "../../../../common/types/social-media.types";
import {Role} from "../../../../common/types/user.types";
import {PaginatedListResponseDto} from "../../../../common/dto/responses/paginated-list-response.dto";
import {SearchListResponseDto} from "../../../../common/dto/responses/search-response.dto";
import {CampaignPaymentStatusEnum, CampaignStatusEnum} from "../../../../common/types/client/campaign.types";
import {PaginationQueryDto} from "../../../../common/dto/requests/pagination-query.dto";
import {IsEnum} from "class-validator";

export class GetAdminCampaignsListQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({ type: String, enum: CampaignStatusEnum })
    @IsEnum(CampaignStatusEnum)
    status?: CampaignStatusEnum;
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

    @ApiProperty({ type: Number })
    followers: number;

    @ApiProperty({ type: Number })
    cost: number;

    @ApiProperty({ type: Number })
    salePrice: number;

    @ApiProperty({ type: Number })
    publicPrice: number;

    @ApiProperty({ type: String })
    createdAt: string;

    @ApiProperty({ type: String, enum: CampaignStatusEnum })
    status: CampaignStatusEnum;

    @ApiProperty({ type: Boolean })
    reportSent: boolean;

    @ApiProperty({ type: String, enum: CampaignPaymentStatusEnum })
    paymentStatus: CampaignPaymentStatusEnum;

    @ApiProperty({ type: String })
    invoiceId: string;

    @ApiProperty({ type: String })
    shortInvoiceId: string;

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