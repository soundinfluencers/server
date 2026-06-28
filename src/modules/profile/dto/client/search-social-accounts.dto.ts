import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SocialMediaEnum } from '../../../../common/types/social-media.types';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  CommunityMusicGenres,
  CommunityThemeTopics,
  CreatorContentFocus,
  CreatorMusicGenres,
  InfluencerProfileCategory,
  SocialAccountSortByEnum,
} from '../../../../common/types/influencer/influencer.types';
import { Type } from 'class-transformer';
import { CurrencyCode } from '../../../../common/types/finance.types';

export class GetFilteredAccountsQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be >= 1' })
  page: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be >= 1' })
  limit: number;

  @ApiProperty()
  @IsEnum(SocialAccountSortByEnum, {
    message: 'sortBy has invalid value',
  })
  sortBy: SocialAccountSortByEnum;
}

export class GetFilteredAccountsBodyDto {
  @ApiPropertyOptional({
    name: 'socialMedias',
    isArray: true,
    enum: SocialMediaEnum,
  })
  @IsOptional()
  @IsArray({ message: 'socialMedias must be an array' })
  @IsEnum(SocialMediaEnum, {
    each: true,
    message: `socialMedias must contain only valid SocialMediaEnum values`,
  })
  socialMedias?: SocialMediaEnum[];

  @ApiPropertyOptional({
    name: 'profileTypes',
    isArray: true,
    enum: InfluencerProfileCategory,
  })
  @IsOptional()
  @IsArray({ message: 'profileTypes must be an array' })
  @IsEnum(InfluencerProfileCategory, {
    each: true,
    message: 'profileTypes must contain only valid InfluencerProfileCategory values',
  })
  profileTypes?: InfluencerProfileCategory[];

  @ApiPropertyOptional({
    name: 'communityMusicGenres',
    type: 'string',
    isArray: true,
    enum: CommunityMusicGenres,
  })
  @IsOptional()
  @IsArray({ message: 'communityMusicGenres must be an array of strings' })
  @IsEnum(CommunityMusicGenres, {
    each: true,
    message: 'communityMusicGenres must contain only valid CommunityMusicGenres values',
  })
  communityMusicGenres?: CommunityMusicGenres[];

  @ApiPropertyOptional({
    name: 'communityThemeTopics',
    type: 'string',
    isArray: true,
    enum: CommunityThemeTopics,
  })
  @IsOptional()
  @IsArray({ message: 'communityThemeTopics must be an array of strings' })
  @IsEnum(CommunityThemeTopics, {
    each: true,
    message: 'communityThemeTopics must contain only valid CommunityThemeTopics values',
  })
  communityThemeTopics?: CommunityThemeTopics[];

  @ApiPropertyOptional({
    name: 'creatorMusicGenres',
    type: 'string',
    isArray: true,
    enum: CreatorMusicGenres,
  })
  @IsOptional()
  @IsArray({ message: 'creatorMusicGenres must be an array of strings' })
  @IsEnum(CreatorMusicGenres, {
    each: true,
    message: 'creatorMusicGenres must contain only valid CreatorMusicGenres values',
  })
  creatorMusicGenres?: CreatorMusicGenres[];

  @ApiPropertyOptional({
    name: 'creatorContentFocus',
    type: 'string',
    isArray: true,
    enum: CreatorContentFocus,
  })
  @IsOptional()
  @IsArray({ message: 'creatorContentFocus must be an array of strings' })
  @IsEnum(CreatorContentFocus, {
    each: true,
    message: 'creatorContentFocus must contain only valid CreatorContentFocus values',
  })
  creatorContentFocus?: CreatorContentFocus[];

  @ApiPropertyOptional({
    name: 'countries',
    type: 'string',
    isArray: true,
  })
  @IsOptional()
  @IsString({ each: true })
  @IsArray({ message: 'countries must be an array of country codes/strings' })
  countries?: string[];

  @ApiPropertyOptional({
    name: 'budget',
    type: 'number',
  })
  @Type(() => Number)
  @IsNumber(
    {},
    {
      message: 'budget must be a number',
    },
  )
  @IsOptional()
  budget?: number;

  @ApiPropertyOptional({
    name: 'budgetCurrency',
    enum: CurrencyCode,
  })
  @IsOptional()
  @IsEnum(CurrencyCode, {
    message: 'budgetCurrency must be a valid CurrencyCode',
  })
  budgetCurrency?: CurrencyCode;
}

// for searching social accounts
export class SearchSocialAccountsDto {
  @ApiProperty({ description: 'Username query (partial match by default)' })
  @IsString()
  query: string;

  @ApiProperty({
    description: 'Which social medias to search in',
    isArray: true,
    enum: SocialMediaEnum,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(SocialMediaEnum, { each: true })
  socialMedias: SocialMediaEnum[];

  @ApiPropertyOptional({ description: 'Page number (starts from 1)', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
