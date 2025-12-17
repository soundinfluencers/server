import { ApiProperty } from '@nestjs/swagger';

export class SendNewFullServicedCampaignRequest {
  clientId?: string | undefined;

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
