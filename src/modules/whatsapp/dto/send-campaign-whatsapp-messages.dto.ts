import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CampaignWhatsappAccountDto {
    @ApiProperty()
    @IsString()
    messageId: string;

    @ApiProperty()
    @IsString()
    accountId: string;

    @ApiProperty()
    @IsString()
    socialMedia: string;

    @ApiProperty()
    @IsString()
    username: string;
}

export class SendCampaignWhatsappMessagesDto {
    @ApiProperty()
    @IsString()
    campaignId: string;

    @ApiProperty({ example: 'hello' })
    @IsString()
    message: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    clientId?: string;

    @ApiProperty({ type: [CampaignWhatsappAccountDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CampaignWhatsappAccountDto)
    accounts: CampaignWhatsappAccountDto[];
}
