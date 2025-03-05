import { ApiProperty } from '@nestjs/swagger';

export class SendNewFullServicedCampaignRequest {
    @ApiProperty({ required: true })
    encryptedClientId: string;

    @ApiProperty({ required: true })
    campaignGoal: string;

    @ApiProperty({ required: true })
    videos: string;

    @ApiProperty({ required: true })
    music: string;

    @ApiProperty({ required: true })
    budget: string;

    @ApiProperty({ required: false })
    additional: string;
}