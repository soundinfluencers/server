import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { FoundAccountDto } from '../../profile/dto/influencer/get-profile.dto';
import { IsGenreAllowedForSocialMedia } from '../../../common/decorators/dto/genre-for-social-media.decorator';
import { OfferSocialMediaEnum } from 'src/common/types/offer.types';
import {
  CommunityMusicGenres,
  CreatorMusicGenres,
} from 'src/common/types/influencer/influencer.types';

export class GetFilteredPublishedOffers {
  @ApiProperty({
    name: 'socialMedia',
    type: 'string',
    enum: OfferSocialMediaEnum,
    required: true,
  })
  @IsEnum(OfferSocialMediaEnum)
  socialMedia: OfferSocialMediaEnum;

  @ApiProperty({
    name: 'genre',
    type: 'string',
    required: true,
    description: 'Must be one of the genres allowed for the selected socialMedia',
  })
  @IsString()
  @IsNotEmpty()
  @IsGenreAllowedForSocialMedia()
  genre: string;
}

export class FilteredPublishedOffersByGenreAndSocialMedia {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ type: String, enum: OfferSocialMediaEnum })
  socialMedia: OfferSocialMediaEnum;

  @ApiProperty({ type: () => [FoundAccountDto] })
  connectedAccounts: FoundAccountDto[];

  @ApiProperty()
  price: number;

  @ApiProperty()
  genre?: CommunityMusicGenres | CreatorMusicGenres;

  @ApiProperty()
  combinedFollowers?: number;

  @ApiProperty()
  networksAmount?: string;

  @ApiProperty()
  storyAndPostDetails?: string;
}
