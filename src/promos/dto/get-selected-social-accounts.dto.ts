import { ApiProperty } from '@nestjs/swagger';
import mongoose from 'mongoose';

interface selectedAccountsType {
  influencerId: string;
  instagramUsername: string;
  socialMedia: string;
}

export class GetSelectedSocialAccountsDto {
  @ApiProperty({
    required: true,
    type: 'array',
    items: {
      type: 'object',
    },
  })
  selectedAccounts: selectedAccountsType[];
}
