import { ApiProperty } from '@nestjs/swagger';

export class AdminUpdateCampaignDto {
  @ApiProperty({ required: true })
  _id: string;

  @ApiProperty({ required: false })
  clientId: string;

  @ApiProperty({ required: false })
  replacementsNotes: string;

  @ApiProperty({ required: false })
  partialRefund: number;

  @ApiProperty({ required: false })
  campaignName: string;

  @ApiProperty({ required: false })
  campaignPrice: number;
}
