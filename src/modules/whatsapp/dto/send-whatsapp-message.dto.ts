import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SendWhatsappMessageDto {
    @ApiProperty({ example: 'Hello' })
    @IsString()
    message: string;

    @ApiProperty({ example: '+380935298273' })
    @IsString()
    phone: string;

    @ApiPropertyOptional({
        description: 'Frontend-generated tab correlation key stored in sessionStorage.',
    })
    @IsOptional()
    @IsString()
    clientId?: string;
}
