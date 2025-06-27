import { ApiProperty } from '@nestjs/swagger';

export class AdminSendMailToInfluencerDto {
  @ApiProperty({ required: true })
  campaignId: string;

  @ApiProperty({ required: true })
  selectInfluencersAccountId: string;
}
