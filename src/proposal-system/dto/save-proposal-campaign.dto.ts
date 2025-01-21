import {ApiProperty} from '@nestjs/swagger';

interface VideoType {
    videoLink: string;
    postDescription: string;
    storyTag: string;
    swipeUpLink: string;
    specialWishes: string;
}

interface selectInfluencersType {
    influencerId: string;
    instagramUsername: string;
    logo: string;
    price: string;
    publicPrice: string;
    selectedVideo: string;
    dateRequest: string;
    followersNumber: number; 
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
    videos: VideoType[];
    
    @ApiProperty({required: false, default: 0})
    publicPrice: number;
    
    @ApiProperty({required: false, default: 0})
    price: number;
    
    @ApiProperty({required: false, default: 0})
    totalFollowers: number;
    
    @ApiProperty({required: true})
    socialMedia: string;
}