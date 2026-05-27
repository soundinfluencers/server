import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../../../common/types/user.types';
import { PaginatedListResponseDto } from '../../../../common/dto/responses/paginated-list-response.dto';
import {
  AdminRequestResponseAction,
  RequestSpecifiedStatus,
  RequestForAdminType,
  RequestLifecycleState,
  RequestGroup,
} from '../../../../common/types/request-for-admin/request-for-admin.types';
import { PaginationQueryDto } from '../../../../common/dto/requests/pagination-query.dto';
import { IsEnum, IsOptional } from 'class-validator';
import {
  BespokeRequestCategory,
  CampaignPaymentMethodEnum,
} from '../../../../common/types/client/campaign.types';
import { SocialMediaEnum } from '../../../../common/types/social-media.types';
import { ExtendedSocialAccountDetailsDto } from '../../../profile/dto/influencer/get-profile.dto';

// DTO query for fetching paginated list of different requests
export class AdminRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: RequestGroup,
    description: 'Request group',
  })
  @IsOptional()
  @IsEnum(RequestGroup)
  group?: RequestGroup;

  @ApiPropertyOptional({
    enum: RequestLifecycleState,
    description: 'Request lifecycle state',
  })
  @IsOptional()
  @IsEnum(RequestLifecycleState)
  state?: RequestLifecycleState;
}

// Admin request DTO for admin requests list
export class AdminRequestForListDto {
  @ApiProperty({ type: String })
  requestId: string;

  @ApiProperty({ type: String })
  label: string;

  @ApiProperty({ type: String })
  submittedBy: string;

  @ApiProperty({ type: String, example: '12.08.2026' })
  date: string;

  @ApiProperty({ enum: RequestGroup })
  group: RequestGroup;

  @ApiProperty({ enum: RequestForAdminType })
  type: RequestForAdminType;

  @ApiProperty({ enum: RequestLifecycleState })
  lifecycleStatus: RequestLifecycleState;

  @ApiProperty({ enum: RequestSpecifiedStatus })
  specifiedStatus: RequestSpecifiedStatus;
}

// DTO for request list
export class AdminRequestsListResponseDto extends PaginatedListResponseDto<AdminRequestForListDto> {
  @ApiProperty({
    type: [AdminRequestForListDto],
    description: 'List of requests',
  })
  items: AdminRequestForListDto[];
}

// DTO for request search result
export class AdminRequestsSearchResponseDto extends PaginatedListResponseDto<AdminRequestForListDto> {
  @ApiProperty({
    type: [AdminRequestForListDto],
    description: 'List of requests',
  })
  items: AdminRequestForListDto[];
}

class AdminRequestDetailsBase {
  @ApiProperty({ type: String })
  requestId: string;

  @ApiProperty({ enum: RequestGroup })
  group: RequestGroup;

  @ApiProperty({ enum: RequestForAdminType })
  type: RequestForAdminType;

  @ApiProperty({ type: String, example: '12.08.2026' })
  date: string;

  @ApiProperty({ type: String })
  firstName: string;

  @ApiProperty({ type: String })
  lastName: string;

  @ApiProperty({ type: String })
  email: string;
}

// DTO for new client request details
export class NewClientRequestDetailsDto extends AdminRequestDetailsBase {
  @ApiProperty({ type: String })
  clientId: string;

  @ApiProperty({ type: String })
  phone: string;

  @ApiProperty({ type: String })
  companyName: string;

  @ApiProperty({ type: String })
  companyType: string;

  @ApiProperty({ type: String })
  referralCode: string;
}

// campaign content item for campaign request details
class CampaignRequestContentItemDto {
  @ApiProperty({ type: String, enum: SocialMediaEnum })
  socialMedia: SocialMediaEnum;

  @ApiProperty({ type: String })
  mainLink: string;

  @ApiProperty({ type: String, isArray: true })
  descriptions: string[];

  @ApiProperty({ type: String, isArray: true })
  accounts: string[]; // connected accounts' usernames

  @ApiProperty({ type: String })
  additionalBrief?: string;

  @ApiProperty({ type: String })
  dateRequest?: string;
}

// DTO for campaign request details
export class CampaignRequestDetailsDto extends AdminRequestDetailsBase {
  @ApiProperty({ type: String })
  clientId: string;

  @ApiProperty({ type: String })
  campaignName: string;

  @ApiProperty({ type: String, enum: CampaignPaymentMethodEnum })
  paymentMethod: CampaignPaymentMethodEnum;

  @ApiProperty({ type: CampaignRequestContentItemDto, isArray: true })
  items: CampaignRequestContentItemDto[];
}

// DTO for bespoke campaign request details
export class BespokeCampaignRequestDetailsDto extends AdminRequestDetailsBase {
  @ApiProperty({ type: String })
  clientId: string;

  @ApiProperty({ type: String })
  phoneNumber: string;

  @ApiProperty({ type: String, enum: BespokeRequestCategory })
  category: BespokeRequestCategory;

  @ApiPropertyOptional({ type: String })
  campaignGoal?: string;

  @ApiPropertyOptional({ type: String })
  contentLink?: string;

  @ApiPropertyOptional({ type: Number })
  budget?: number;

  @ApiPropertyOptional({ type: String })
  targetTerritories?: string;

  @ApiPropertyOptional({ type: String })
  extraBriefs?: string;

  @ApiPropertyOptional({ type: String })
  trackLink?: string;

  @ApiPropertyOptional({ type: String, example: '12.08.2026' })
  releaseDate?: string;

  @ApiPropertyOptional({ type: String })
  smartLink?: string;

  @ApiPropertyOptional({ type: String })
  ticketLink?: string;
}

// DTO for new influencer request details
export class NewInfluencerRequestDetailsDto extends AdminRequestDetailsBase {
  @ApiProperty({ type: String })
  influencerId: string;

  @ApiProperty({ type: String })
  phoneNumber: string;

  @ApiProperty({ type: ExtendedSocialAccountDetailsDto, isArray: true })
  accounts: ExtendedSocialAccountDetailsDto[];
}

// DTO for price update request details
export class PriceUpdateRequestDetailsDto extends AdminRequestDetailsBase {
  @ApiProperty({ type: String })
  influencerId: string;

  @ApiProperty({ type: String })
  phoneNumber: string;

  @ApiProperty({ type: String })
  accountId: string;

  @ApiProperty({ type: String })
  username: string;

  @ApiProperty({ type: String, enum: SocialMediaEnum })
  socialMedia: SocialMediaEnum;

  @ApiProperty({ type: Number })
  currentPrice: number;

  @ApiProperty({ type: String })
  currentCurrency: string;

  @ApiProperty({ type: Number })
  newPrice: number;

  @ApiProperty({ type: String })
  newCurrency: string;
}
