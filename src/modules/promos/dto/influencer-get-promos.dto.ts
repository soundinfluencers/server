import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {
    InfluencerConfirmationStatusEnum,
    InfluencerConfirmationStatusType, InfluencerDashboardPromo,
    InfluencerPromo, InfluencerPromoClosedStatusEnum, InfluencerPromoClosedStatusType,
    InfluencerPromoRequest
} from "../../../common/types/influencer/promo.types";
import {SocialMediaEnum, SocialMediaType} from "../../../common/types/social-media.types";
import {CampaignStatusEnum, CampaignStatusType} from "../../../common/types/client/campaign.types";

// dto for request influencer's past promo (query)
export class InfluencerGetPastPromoQueryDto {
    @ApiProperty({
        description: 'Campaign _id',
        example: '65f123abc456',
    })
    campaignId: string;

    @ApiProperty({
        description: '_id of needed object inside of addedAccounts array from campaign',
        example: '6612fabc999',
    })
    selectInfluencersId: string;
}

// dto for returning detailed new promo request
export class InfluencerPromoRequestDto implements InfluencerPromoRequest {
    @ApiProperty()
    campaignId: string;

    @ApiProperty()
    influencerId: string;

    @ApiProperty()
    selectInfluencersId: string;

    @ApiProperty()
    client?: string;

    @ApiProperty()
    campaignName: string;

    @ApiProperty()
    socialMediaUsername: string;

    @ApiProperty()
    socialMedia: SocialMediaType;

    @ApiProperty({ type: String, format: 'date-time' })
    dateRequest: string | Date;

    @ApiProperty({ type: String, format: 'date-time' })
    createdAt: string | Date;

    @ApiProperty()
    videoLink: string;

    @ApiProperty()
    postDescription: string;

    @ApiProperty()
    storyTag?: string;

    @ApiProperty()
    storyLink?: string;

    @ApiProperty()
    additionalBrief?: string;
}

// dto for returning an array of detailed new promos requests
export class InfluencerGetPromoRequestsDto {
    @ApiProperty({ type: () => [InfluencerPromoRequestDto] })
    promos: InfluencerPromoRequest[];
}

// dto for request for updating influencer's response for new promo request
export class InfluencerUpdatePromoResponseUpdateDto {
    @ApiProperty({
        description: 'Campaign _id',
        example: '65f123abc456',
    })
    campaignId: string;

    @ApiProperty({
        description: '_id of needed object inside of addedAccounts array from campaign',
        example: '6612fabc999',
    })
    selectInfluencersId: string;

    @ApiProperty({
        description: "Username of influencer's social account",
        example: 'techno_tv',
    })
    socialMediaUsername: string;

    @ApiProperty({
        description: "Influencer's response to new promo request",
        example: "accept",
        enum: InfluencerConfirmationStatusEnum
    })
    campaignResponse: InfluencerConfirmationStatusType;
}

// dto for returning detailed ongoing promo
export class InfluencerGetOngoingOrPastPromoResDto extends InfluencerPromoRequestDto implements InfluencerPromo {
    @ApiProperty({ enum: CampaignStatusEnum })
    statusCampaign: CampaignStatusType;

    @ApiProperty({ enum: InfluencerPromoClosedStatusEnum })
    closedStatus: InfluencerPromoClosedStatusType;

    @ApiProperty({ enum: InfluencerConfirmationStatusEnum })
    confirmation: InfluencerConfirmationStatusType;
}

// dto for returning an array of detailed ongoing promos
export class InfluencerGetOngoingOrPastPromosResDto {
    @ApiProperty({ type: () => [InfluencerGetOngoingOrPastPromoResDto] })
    promos: InfluencerGetOngoingOrPastPromoResDto[];
}

// dto for request for closing influencer's ongoing promo PART 1 (query)
export class InfluencerUpdatePromoReqQueryDto {
    @ApiProperty({
        description: 'Campaign _id',
        example: '65f123abc456',
    })
    campaignId: string;

    @ApiProperty({
        description: '_id of needed object inside addedAccounts array from campaign',
        example: '6612fabc999',
    })
    selectInfluencersId: string;

    @ApiProperty({
        description: "Username of influencer's social account",
        example: 'techno_tv',
    })
    socialMediaUsername: string;

    influencerId?: string | undefined;
}

// dto for request for closing influencer's ongoing promo PART 2 (body)
// TODO: finish InfluencerUpdatePromoReqBodyDto
export class InfluencerUpdatePromoReqBodyDto {
    @ApiProperty()
    result: string;
}

export enum InfluencerDashboardPromoStatus {
    ongoing = 'ongoing',
    close = 'close',
    new = 'new',
    all = 'all',
}

export class InfluencerGetDashboardPromosQueryDto {
    @ApiPropertyOptional({
        description: 'Type of promos returned',
        enum: InfluencerDashboardPromoStatus,
        default: InfluencerDashboardPromoStatus.all,
    })
    status: InfluencerDashboardPromoStatus;

    @ApiPropertyOptional({
        default: 12,
    })
    limit: number;

    @ApiPropertyOptional({
        default: 1,
        description: 'Page number (starts from 1)',
    })
    page: number;

    influencerId: string;
}

export class InfluencerGetCompletedPromosQueryDto {
    @ApiPropertyOptional({
        description: 'Type of promos returned',
        example: 'all',
        enum: InfluencerDashboardPromoStatus,
        default: InfluencerDashboardPromoStatus.all
    })
    status: InfluencerDashboardPromoStatus

    @ApiPropertyOptional({
        default: 12
    })
    limit: number;

    influencerId: string;
}

export class InfluencerDashboardPromoDto implements InfluencerDashboardPromo {
    @ApiProperty({
        description: 'Campaign _id',
        example: '65f123abc456',
    })
    campaignId: string;

    @ApiProperty({
        description: '_id of object inside addedAccounts array from campaign',
        example: '6612fabc999',
    })
    selectInfluencersId: string;

    @ApiProperty({
        description: 'Campaign name',
        example: 'Regard & Afterlife',
    })
    campaignName: string;

    @ApiProperty({
        description: 'Social media of account',
        example: 'tiktok',
        enum: SocialMediaEnum
    })
    socialMedia: SocialMediaType;

    @ApiProperty({
        description: 'Status of campaign',
        example: 'Pending',
        enum: CampaignStatusEnum
    })
    statusCampaign: CampaignStatusType;

    @ApiProperty({
        description: 'Account closed status for promo',
        example: 'closed',
        enum: InfluencerPromoClosedStatusEnum
    })
    closedStatus: InfluencerPromoClosedStatusType;

    @ApiProperty({
        description: 'Account confirmation status for promo',
        example: 'accept',
        enum: InfluencerConfirmationStatusEnum
    })
    confirmation: InfluencerConfirmationStatusType;

    @ApiProperty({
        description: 'Date when campaign was created',
        example: '12.08.25',
    })
    createdAt: string;
}

export class InfluencerDashboardPromosDto {
    @ApiProperty({ type: () => [InfluencerDashboardPromoDto] })
    promos: InfluencerDashboardPromo[];
}