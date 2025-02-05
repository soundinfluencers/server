import {ApiProperty} from '@nestjs/swagger';

interface selectInfluencersType {
    influencerId: string;
    socialMedia: string;
    socialMediaUsername: string;
    selectedCampaignContentItem: string;
    dateRequest: string;
}

interface campaignContentItemType {
    videoLink: string;
    postDescription: string;
    storyTag: string;
    swipeUpLink: string;
    specialWishes: string;
}

export class CreatePromosDto {
    @ApiProperty({required: true})
    clientId: string;

    @ApiProperty({
        required: true,
        type: 'array',
        items: {
            type: 'object',
        },
    })
    selectInfluencers: selectInfluencersType[];

    @ApiProperty({
        required: true,
        type: 'array',
        items: {
            type: 'object',
        },
    })
    campaignContent: campaignContentItemType[];

    @ApiProperty({required: true})
    campaignName: string;

    @ApiProperty({required: true})
    paymentType: string;

    @ApiProperty({required: true, default: 'wait'})
    paymentStatus: string;

    @ApiProperty({required: true})
    campaignPrice: number;

    @ApiProperty({required: true})
    createdAt: string;

    @ApiProperty({required: true})
    socialMedia: string;
}
