import { ApiProperty } from '@nestjs/swagger';
import {
    InfluencerConfirmationStatusEnum,
    InfluencerConfirmationStatusType,
    InfluencerPromo, InfluencerPromoClosedStatusEnum, InfluencerPromoClosedStatusType,
    InfluencerPromoRequest
} from "../../../common/types/influencer/promo.types";
import {SocialMediaType} from "../../../common/types/social-media.types";
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
        description: '_id of needed object inside of addedAccounts array from campaign',
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