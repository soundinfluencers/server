import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {PaginatedListResponseDto} from "../../../../common/dto/responses/paginated-list-response.dto";
import {SearchListResponseDto} from "../../../../common/dto/responses/search-response.dto";

// DTO client latest campaign for admin clients list
class ClientLatestCampaignDto {
    @ApiProperty({ type: String })
    campaignName: string;

    @ApiProperty({ type: String })
    campaignId: string;
}

// DTO client for admin clients list
export class AdminClientResponseDto {
    @ApiProperty({ type: String })
    company: string;

    @ApiProperty({ type: String })
    firstName: string;

    @ApiProperty({ type: String })
    lastName: string;

    @ApiProperty({ type: String })
    email: string;

    @ApiProperty({ type: String })
    phone: string;

    @ApiProperty({ type: String })
    companyType: string;

    @ApiProperty({ type: String })
    id: string;

    @ApiProperty({ type: Boolean })
    proposalAccess: boolean;

    @ApiProperty({ type: Number })
    campaignsCompleted: number;

    @ApiProperty({ type: Number })
    campaignsActive: number;

    @ApiPropertyOptional({ type: ClientLatestCampaignDto })
    latestCampaign?: ClientLatestCampaignDto;

    @ApiPropertyOptional({ type: String })
    internalNote?: string;
}

export class AdminClientsListResponseDto extends PaginatedListResponseDto<AdminClientResponseDto> {
    @ApiProperty({
        type: [AdminClientResponseDto],
        description: 'List of clients',
    })
    items: AdminClientResponseDto[];
}

export class AdminClientsSearchResponseDto extends SearchListResponseDto<AdminClientResponseDto> {
    @ApiProperty({
        type: [AdminClientResponseDto],
        description: 'List of clients',
    })
    items: AdminClientResponseDto[];
}