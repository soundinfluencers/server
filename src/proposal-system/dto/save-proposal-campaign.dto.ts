import {ApiProperty} from '@nestjs/swagger';

interface campaignContentItemType {
    _id: string;
    videoLink: string;
    postDescription: string;
    storyTag: string;
    swipeUpLink: string;
    specialWishes: string;
    socialMedia: string;
}

interface selectInfluencersType {
    _id: string;
    influencerId: string;
    socialMediaUsername: string;
    price: string;
    publicPrice: string;
    selectedCampaignContentItem: string;
    dateRequest: string;
    followersNumber: number; 
    socialMedia: string;
    genres: string[];
    countries: object[];
}

export class SaveProposalCampaignDto {
    @ApiProperty({required: true})
    campaignId: string;
    
    @ApiProperty({required: false})
    clientId: string;

    @ApiProperty({required: true})
    campaignName: string;

    @ApiProperty({required: false})
    selectInfluencers: selectInfluencersType[];

    @ApiProperty({required: false})
    campaignContent: campaignContentItemType[];
    
    @ApiProperty({required: false, default: 0})
    publicPrice: number;
    
    @ApiProperty({required: false, default: 0})
    price: number;
    
    @ApiProperty({required: false, default: 0})
    totalFollowers: number;
    
    @ApiProperty({required: true})
    socialMedia: string;
}