import {ApiProperty} from "@nestjs/swagger";

export class AdminUpdateCampaignVideoDto {
    @ApiProperty({required: true})
    _id: string;

    @ApiProperty({required: true})
    campaignContentItemId: string;
    
    @ApiProperty({required: false})
    videoLink: string;
    
    @ApiProperty({required: false})
    postDescription: string;
    
    @ApiProperty({required: false})
    storyTag: string;
    
    @ApiProperty({required: false, default: ''})
    swipeUpLink: string;
    
    @ApiProperty({required: false, default: ''})
    specialWishes: string;
    
    @ApiProperty({required: true})
    isNewCampaignContentItem: boolean;
    
    @ApiProperty({required: true})
    selectedSocialMediaAccountUsername: string;
    
    @ApiProperty({required: true})
    selectInfluencersAccountId: string;
}
