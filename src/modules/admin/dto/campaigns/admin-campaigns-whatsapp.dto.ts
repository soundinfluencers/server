import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SendWhatsappToInfluencerDto {
  @ApiProperty({ description: 'Influencer ID' })
  @IsString()
  influencerId: string;

  @ApiProperty({ description: 'Social account ID' })
  @IsString()
  accountId: string;

  @ApiProperty({ description: 'Social media platform' })
  @IsString()
  socialMedia: string;

  @ApiProperty({ example: 'Hello!' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Frontend tab correlation key' })
  @IsOptional()
  @IsString()
  clientId?: string;
}

export class SendWhatsappToCampaignDto {
  @ApiProperty({ description: 'Campaign ID' })
  @IsString()
  campaignId: string;

  @ApiProperty({ example: 'Hello!' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Frontend tab correlation key' })
  @IsOptional()
  @IsString()
  clientId?: string;
}
