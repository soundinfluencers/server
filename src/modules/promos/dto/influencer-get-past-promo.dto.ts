import { ApiProperty } from '@nestjs/swagger';
import {InfluencerPastPromo} from "../../../common/types/influencer/promo.types";
import {Types} from "mongoose";
import {SocialMediaType} from "../../../common/types/social-media.types";

export class InfluencerGetPastPromoReqDto {
    @ApiProperty()
    campaignId: string;

    @ApiProperty()
    influencerId: string;

    @ApiProperty()
    selectInfluencersId: string;
}

export class InfluencerPastPromoDto implements InfluencerPastPromo {
    @ApiProperty()
    promoId: string;

    @ApiProperty()
    campaignName: string;

    @ApiProperty()
    influencerId: string | Types.ObjectId;

    @ApiProperty()
    socialMediaUsername: string;

    @ApiProperty()
    dateRequest: string | Date;

    @ApiProperty()
    client: string;

    @ApiProperty()
    socialMedia: SocialMediaType;

    @ApiProperty()
    videoLink: string;

    @ApiProperty()
    postDescription: string;

    @ApiProperty()
    storyTag?: string;

    @ApiProperty()
    storyLink?: string;

    @ApiProperty()
    specialWishes?: string;
}

export class InfluencerGetPastPromoResDto {
    @ApiProperty()
    statusCode: number;

    @ApiProperty({ required: false })
    pastPromo?: InfluencerPastPromoDto;

    @ApiProperty()
    message: string | null = null;
}