import { ApiProperty } from '@nestjs/swagger';

export class OneCampaignQueryDto {
    @ApiProperty()
    campaignId: string;

    @ApiProperty()
    influencerId: string;

    @ApiProperty()
    selectInfluencersId: string;
}
