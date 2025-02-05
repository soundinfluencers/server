import { ApiProperty } from '@nestjs/swagger';

export class AdminUpdateCampaignInfluencersDto {
    @ApiProperty({ required: true })
    campaignId: string;
    
    @ApiProperty({required: true})
    socialMediaUsername: string;
    
    @ApiProperty({required: true})
    selectInfluencersAccountId: string;
    
    @ApiProperty({required: false})
    impressions: string;

    @ApiProperty({required: false})
    like: string;
    
    @ApiProperty({required: false})
    screenshot: string;
    
    @ApiProperty({required: false})
    postLink: string;
}