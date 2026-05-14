import {ApiProperty, ApiPropertyOptional, getSchemaPath} from '@nestjs/swagger';
import {
    InfluencerCompletedPromo,
    InfluencerConfirmationStatusEnum,
    InfluencerConfirmationStatusType, InfluencerDashboardPromo,
    InfluencerDashboardPromoStatusRequest,
    InfluencerDetailedPromoStatusRequest, InfluencerNewPromoRequest, InfluencerOngoingPromo, InfluencerPromoBase,
    InfluencerPromoClosedStatusEnum, InfluencerPromoClosedStatusType,
    InfluencerUpdatedPostDetails
} from "../../../common/types/influencer/promo.types";
import {SocialMediaEnum, SocialMediaType} from "../../../common/types/social-media.types";
import {CampaignStatusEnum} from "../../../common/types/client/campaign.types";
import {
    IsEnum,
    IsInt,
    IsMongoId, IsNotEmpty, isNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUrl,
    Max,
    Min,
    ValidateNested
} from "class-validator";
import {Type} from "class-transformer";

// base dto for returning promo (won't be used in any controller)
class InfluencerPromoBaseDto implements InfluencerPromoBase {
    @ApiProperty({type: String})
    campaignId: string;

    @ApiProperty({type: String})
    influencerId: string;

    @ApiProperty({type: String})
    addedAccountsId: string;

    @ApiPropertyOptional({type: String})
    socialAccountId?: string;

    @ApiPropertyOptional({type: String})
    logoUrl?: string;

    @ApiProperty({type: String})
    campaignName: string;

    @ApiProperty({type: String})
    username: string;

    @ApiProperty({enum: SocialMediaEnum, type: String})
    accountSocialMedia: SocialMediaType;

    @ApiProperty({
        description: 'Date when campaign was created',
        example: 'dd.mm.yy',
    })
    createdAt: string;
}

// type for returning detailed promo with specific type
export type InfluencerDetailedPromo =
    | InfluencerNewPromoRequestDto
    | InfluencerOngoingPromoDto
    | InfluencerCompletedPromoDto;


//  --------------- REQUESTS ------------------


// dto request for updating influencer's response for new promo request
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
    addedAccountsId: string;

    @ApiProperty({
        description: "Username of influencer's social account",
        example: 'techno_tv',
    })
    username: string;

    @ApiProperty({
        description: "Influencer's response to new promo request",
        example: "accept",
        enum: InfluencerConfirmationStatusEnum
    })
    campaignResponse: InfluencerConfirmationStatusType;
}

// dto for request with updated promo's post details
export class InfluencerUpdatedPostDetailsDto implements InfluencerUpdatedPostDetails {
    @ApiPropertyOptional({
        description: 'Link to influencer post',
        example: 'https://instagram.com/p/ABC123',
    })
    @IsOptional()
    @IsString()
    @IsUrl()
    postLink?: string;

    @ApiPropertyOptional({
        description: 'Screenshot URL of the post',
        example: 'https://cdn.example.com/screenshots/post.png',
    })
    @IsOptional()
    @IsString()
    @IsUrl()
    screenshotUrl?: string;

    @ApiPropertyOptional({
        description: 'Post impressions count',
        example: 15234,
        minimum: 0,
    })
    @IsOptional()
    @IsInt()
    @Min(0)
    impressions?: number;

    @ApiPropertyOptional({
        description: 'Post likes count',
        example: 823,
        minimum: 0,
    })
    @IsOptional()
    @IsInt()
    @Min(0)
    like?: number;

    @ApiPropertyOptional({
        description: 'Post comments count',
        example: 190,
        minimum: 0,
    })
    @IsOptional()
    @IsInt()
    @Min(0)
    comments?: number;

    @ApiPropertyOptional({
        description: 'Post shares count',
        example: 703,
        minimum: 0,
    })
    @IsOptional()
    @IsInt()
    @Min(0)
    shares?: number;

    @ApiPropertyOptional({
        description: 'Post saves count',
        example: 323,
        minimum: 0,
    })
    @IsOptional()
    @IsInt()
    @Min(0)
    saves?: number;

    @ApiPropertyOptional({
        description: 'Post favorites count',
        example: 109,
        minimum: 0,
    })
    @IsOptional()
    @IsInt()
    @Min(0)
    favorites?: number;

    @ApiPropertyOptional({
        description: 'Internal rating for the post',
        example: 4.5,
        minimum: 0,
    })
    @IsOptional()
    @Min(0)
    rating?: number;

    @ApiPropertyOptional({
        description: 'Post creation date',
    })
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    datePost?: string;
}

// dto request for closing influencer's ongoing
export class InfluencerUpdatePromoReqBodyDto {
    @ApiProperty({
        description: 'Campaign _id',
        example: '65f123abc456',
    })
    @IsString()
    campaignId: string;

    @ApiProperty({
        description: '_id of needed object inside addedAccounts array from campaign',
        example: '6612fabc999',
    })
    @IsString()
    addedAccountsId: string;

    @ApiProperty({
        description: "Username of influencer's social account",
        example: 'techno_tv',
    })
    @IsString()
    username: string;

    @ApiProperty({
        description: 'Post details to update',
        type: InfluencerUpdatedPostDetailsDto,
    })
    @ValidateNested()
    @Type(() => InfluencerUpdatedPostDetailsDto)
    data: InfluencerUpdatedPostDetailsDto;

    influencerId?: string;
}

// dto request for getting dashboard promos
export class InfluencerGetDashboardPromosQueryDto {
    @ApiPropertyOptional({
        description: 'Type of promos returned',
        enum: InfluencerDashboardPromoStatusRequest,
        default: InfluencerDashboardPromoStatusRequest.all,
    })
    status: InfluencerDashboardPromoStatusRequest;

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

// dto request for getting detailed promos
export class InfluencerGetDetailedPromosQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsMongoId()
    campaignId: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsMongoId()
    addedAccountsId: string;

    @ApiProperty({
        description: 'Type of promos returned',
        enum: InfluencerDetailedPromoStatusRequest,
        default: InfluencerDetailedPromoStatusRequest.ongoing,
    })
    @IsEnum(InfluencerDetailedPromoStatusRequest)
    status: InfluencerDetailedPromoStatusRequest;

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

// dto request for getting detailed promo
export class InfluencerGetDetailedPromoParamsDto {
    @ApiProperty({
        description: 'Type of promos returned',
        enum: InfluencerDetailedPromoStatusRequest,
        default: InfluencerDetailedPromoStatusRequest.ongoing,
    })
    @IsEnum(InfluencerDetailedPromoStatusRequest)
    status: InfluencerDetailedPromoStatusRequest;

    @ApiProperty()
    @IsMongoId()
    campaignId: string;

    @ApiProperty()
    @IsMongoId()
    addedAccountsId: string;

    influencerId: string;
}


//  --------------- RESPONSES ------------------


// dto for returning new promo request
export class InfluencerNewPromoRequestDto extends InfluencerPromoBaseDto implements InfluencerNewPromoRequest {
    @ApiProperty({type: String})
    clientName: string;

    @ApiProperty({
        description: 'Promo deadline',
        example: 'dd.mm.yy',
    })
    dateRequest: string;

    @ApiProperty({type: String})
    mainLink: string;

    @ApiPropertyOptional({type: String})
    description?: string;

    @ApiPropertyOptional({type: String})
    taggedUser?: string;

    @ApiPropertyOptional({type: String})
    taggedLink?: string;

    @ApiPropertyOptional({type: String})
    additionalBrief?: string;
}

// dto for returning dashboard promo
export class InfluencerDashboardPromoDto extends InfluencerPromoBaseDto implements InfluencerDashboardPromo {
    @ApiProperty({type: Number})
    reward: number;

    @ApiProperty({enum: CampaignStatusEnum, type: String})
    statusCampaign: CampaignStatusEnum;

    @ApiProperty({enum: InfluencerPromoClosedStatusEnum, type: String})
    closedStatus: InfluencerPromoClosedStatusType;

    @ApiProperty({enum: InfluencerConfirmationStatusEnum, type: String})
    confirmation: InfluencerConfirmationStatusType;
}

// dto for returning an array of dashboard promos
export class InfluencerDashboardPromosDto {
    @ApiProperty({type: () => [InfluencerDashboardPromoDto]})
    promos: InfluencerDashboardPromo[];
}

// dto for returning completed promo
export class InfluencerCompletedPromoDto extends InfluencerPromoBaseDto implements InfluencerCompletedPromo {
    @ApiProperty({type: String})
    clientName: string;

    @ApiProperty({type: Number})
    reward: number;

    @ApiProperty({type: String})
    postLink: string;
}

// dto for returning detailed ongoing promo
export class InfluencerOngoingPromoDto extends InfluencerPromoBaseDto implements InfluencerOngoingPromo {
    @ApiProperty({type: String})
    clientName: string;

    @ApiProperty({type: Number})
    reward: number;

    @ApiPropertyOptional({type: String})
    postLink?: string;

    @ApiProperty({
        description: 'Promo deadline',
        example: 'dd.mm.yy',
    })
    dateRequest: string;

    @ApiProperty({type: String})
    mainLink: string;

    @ApiPropertyOptional({type: String})
    description?: string;

    @ApiPropertyOptional({type: String})
    taggedUser?: string;

    @ApiPropertyOptional({type: String})
    taggedLink?: string;

    @ApiPropertyOptional({type: String})
    additionalBrief?: string;

    @ApiProperty({enum: CampaignStatusEnum, type: String})
    statusCampaign: CampaignStatusEnum;

    @ApiProperty({enum: InfluencerPromoClosedStatusEnum, type: String})
    closedStatus: InfluencerPromoClosedStatusType;

    @ApiProperty({enum: InfluencerConfirmationStatusEnum, type: String})
    confirmation: InfluencerConfirmationStatusType;
}

// dto for returning an array of detailed promos with specific type
export class InfluencerDetailedPromosDto {
    @ApiProperty({
        oneOf: [
            {$ref: getSchemaPath(InfluencerNewPromoRequestDto)},
            {$ref: getSchemaPath(InfluencerOngoingPromoDto)},
            {$ref: getSchemaPath(InfluencerCompletedPromoDto)}
        ],
        isArray: true,
    })
    promos: InfluencerDetailedPromo[];
}