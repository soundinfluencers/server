import { ApiProperty } from '@nestjs/swagger';

export interface ISocial {
  musicStyle: string;
  musicSubStyles: string[] | null;
  musicStyleOther: string[] | null;
  instagramUsername: string;
  instagramLink: string;
  followersNumber: string;
  logo: string;
  price: string;
  publicPrice: string;
  currency: string | null;
  countries: { country: string; percentage: number }[] | null;
  categories: string[] | null;
  engagementRate: number | null;
  averageViews: number | null;
  creatorCategories?: string[] | null;
  profileCategory: 'community' | 'creator';
  initialPrice?: string;
}


export const typesSocialMedia = {
  musicStyle: { type: 'string' },
  musicSubStyles: { type: 'array', items: { type: 'string' }, nullable: true },
  musicStyleOther: { type: 'array', items: { type: 'string' }, nullable: true },
  instagramUsername: { type: 'string' },
  instagramLink: { type: 'string' },
  followersNumber: { type: 'string' },
  logo: { type: 'string' },
  price: { type: 'string' },
  publicPrice: { type: 'string' },
  currency: { type: 'string', nullable: true, default: 'EUR' },
  countries: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        country: { type: 'string' },
        percentage: { type: 'number' },
      },
    },
    nullable: true,
  },
  categories: { type: 'array', items: { type: 'string' }, nullable: true },
  engagementRate: { type: 'number', nullable: true },
  averageViews: { type: 'number', nullable: true },
  creatorCategories: {
    type: 'array',
    items: { type: 'string' },
    nullable: true,
  },
  profileCategory: {
    type: 'string',
    enum: ['community', 'creator'],
  },
  initialPrice: { type: 'string' },
};


export class CreateInfluencerDto {
  @ApiProperty()
  firstName: string;

  @ApiProperty({
    type: 'array',
    items: { type: 'object', properties: typesSocialMedia },
  })
  tiktok: ISocial[];

  @ApiProperty({
    type: 'array',
    items: { type: 'object', properties: typesSocialMedia },
  })
  soundcloud: ISocial[];

  @ApiProperty({
    type: 'array',
    items: { type: 'object', properties: typesSocialMedia },
  })
  facebook: ISocial[];

  @ApiProperty({
    type: 'array',
    items: { type: 'object', properties: typesSocialMedia },
  })
  instagram: ISocial[];

  @ApiProperty({
    type: 'array',
    items: { type: 'object', properties: typesSocialMedia },
  })
  spotify: ISocial[];

  @ApiProperty({
    type: 'array',
    items: { type: 'object', properties: typesSocialMedia },
  })
  press: ISocial[];

  @ApiProperty({
    type: 'array',
    items: { type: 'object', properties: typesSocialMedia },
  })
  youtube: ISocial[];

  @ApiProperty()
  email: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  password: string;

  @ApiProperty()
  internalNote: string;
}
