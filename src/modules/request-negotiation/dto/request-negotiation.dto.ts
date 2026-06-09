import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendNegotiationMessageDto {
  @ApiProperty({
    description: 'Plain-text message body sent to the request participant',
    maxLength: 10000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body: string;
}
