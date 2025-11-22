import { ApiProperty } from '@nestjs/swagger';

export class AdminUpdateInfluencerFullAccountDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  instagram: [];

  @ApiProperty()
  tiktok: [];

  @ApiProperty()
  youtube: [];

  @ApiProperty()
  facebook: [];

  @ApiProperty()
  spotify: [];

  @ApiProperty()
  soundcloud: [];

  @ApiProperty()
  press: [];
}
