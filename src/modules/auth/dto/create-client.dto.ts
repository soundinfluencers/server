import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ required: true })
  firstName: string;

  @ApiPropertyOptional({ required: false })
  lastName?: string;

  @ApiProperty({ required: true })
  company: string;

  @ApiProperty({ required: true })
  companyType: string;

  @ApiProperty({ required: true })
  instagramUsername: string;

  @ApiProperty({ required: true })
  email: string;

  @ApiProperty({ required: true })
  phone: string;

  @ApiProperty({ required: true })
  referalCode: string;

  @ApiProperty({ required: true })
  password: string;

  @ApiProperty({ required: true })
  internalNote: string;
}
