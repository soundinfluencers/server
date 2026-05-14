import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {PaginatedListResponseDto} from "../../../../common/dto/responses/paginated-list-response.dto";
import {SearchListResponseDto} from "../../../../common/dto/responses/search-response.dto";
import {SocialMediaEnum} from "../../../../common/types/social-media.types";

// DTO client for admin clients list
export class AdminClientForListDto {
    @ApiProperty({ type: String })
    clientId: string;

    @ApiProperty({ type: String })
    company: string;

    @ApiProperty({ type: String })
    name: string;

    @ApiProperty({ type: String })
    email: string;

    @ApiProperty({ type: String })
    companyType: string;

    @ApiProperty({ type: Boolean })
    proposalAccess: boolean;

    @ApiProperty({ type: Number })
    campaignsCompleted: number;

    @ApiProperty({ type: Number })
    campaignsActive: number;
}

// DTO for clients list
export class AdminClientsListResponseDto extends PaginatedListResponseDto<AdminClientForListDto> {
    @ApiProperty({
        type: [AdminClientForListDto],
        description: 'List of clients',
    })
    items: AdminClientForListDto[];
}

// DTO for clients search result
export class AdminClientsSearchResponseDto extends SearchListResponseDto<AdminClientForListDto> {
    @ApiProperty({
        type: [AdminClientForListDto],
        description: 'List of clients',
    })
    items: AdminClientForListDto[];
}

// DTO campaign for detailed client's info
export class CampaignForClientDetailsDto {
    @ApiProperty({ type: String })
    campaignId: string;

    @ApiProperty({ type: String })
    campaignName: string

    @ApiProperty({ type: String, enum: [...Object.values(SocialMediaEnum), 'multipromo'] })
    socialMedia: SocialMediaEnum | 'multipromo';

    @ApiProperty({ type: String })
    date: string;

    @ApiProperty({ type: Number })
    campaignPrice: number;
}

// DTO with detailed client's information
export class AdminDetailedClientDto {
    @ApiProperty({ type: String })
    clientId: string;

    @ApiProperty({ type: String })
    firstName: string;

    @ApiProperty({ type: String })
    company: string;

    @ApiProperty({ type: String })
    email: string;

    @ApiProperty({ type: String })
    phone: string;

    @ApiProperty({ type: String })
    companyType: string;

    @ApiProperty({ type: Boolean })
    proposalAccess: boolean;

    @ApiPropertyOptional({ type: String })
    lastName?: string;

    @ApiPropertyOptional({ type: String })
    latestCampaignName?: string;

    @ApiPropertyOptional({ type: CampaignForClientDetailsDto, isArray: true })
    campaignsActive?: CampaignForClientDetailsDto[];

    @ApiPropertyOptional({ type: CampaignForClientDetailsDto, isArray: true })
    campaignsCompleted?: CampaignForClientDetailsDto[];

    @ApiPropertyOptional({ type: String })
    internalNote?: string;
}