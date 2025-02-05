import { ApiProperty } from '@nestjs/swagger';

interface selectInfluencersType {
    influencerId: string;
    socialMedia: string;
    socialMediaUsername: string;
    confirmation: string;
    postLink: string;
    screenshot: string;
    impressions: string;
    like: string;
    selectedVideo: string;
    dateRequest: string;
}

interface campaignContentItemType {
    videoLink: string;
    postDescription: string;
    storyTag: string;
    swipeUpLink: string;
    specialWishes: string;
}

export class CreatePromosEstimateDto {
    @ApiProperty({ required: true })
    clientId: string;

    @ApiProperty({ required: true, default: 'payment' })
    paymentType: string;

    @ApiProperty({ required: true, default: 'wait' })
    paymentStatus: string;

    @ApiProperty({
        required: true,
        type: 'array',
        items: {
            type: 'object',
        },
    })
    selectInfluencers: selectInfluencersType[];

    @ApiProperty({
        required: false,
        type: 'array',
        items: {
            type: 'object',
        },
    })
    campaignContent: campaignContentItemType[];

    @ApiProperty({ required: false })
    campaignPrice: number;
    
    @ApiProperty({ required: true })
    socialMedia: string;
}