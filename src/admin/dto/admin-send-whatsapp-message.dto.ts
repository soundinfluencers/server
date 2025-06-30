import { ApiProperty } from '@nestjs/swagger';

export class AdminSendWhatsappMessageDto {
  @ApiProperty({ required: true })
  influencerId: string;

  @ApiProperty({ required: true })
  message: string;

  @ApiProperty({ required: true })
  socketId: string;

  @ApiProperty({ required: true })
  networkUsername: string;

  @ApiProperty({ required: true })
  campaignId: string;
}
