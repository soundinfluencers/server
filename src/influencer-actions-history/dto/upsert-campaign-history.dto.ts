import {ApiProperty} from "@nestjs/swagger";

export class UpdateCampaignActionDto {
    @ApiProperty({ type: Number, required: true })
    actionNumber: number;

    @ApiProperty({ type: String, required: true })
    networkUsername: string;
    
    @ApiProperty({ type: Number, required: false }) 
    rewardForInfluencer: number;

    @ApiProperty({ type: String, required: false })
    socialMedia: string;
}

export class UpsertCampaignHistoryDto {
    @ApiProperty({ required: true, type: String })
    influencerId: string;

    @ApiProperty({ type: String, required: false, default: '' })
    campaignId: string;

    @ApiProperty({ type: String, required: false, default: '' })
    campaignName: string;
    
    @ApiProperty({ required: true, type: UpdateCampaignActionDto })
    updatedCampaignAction: UpdateCampaignActionDto;
}
