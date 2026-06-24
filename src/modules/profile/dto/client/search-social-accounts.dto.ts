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
  @IsString({ each: true })
  @IsArray({ message: 'communityMusicGenres must be an array of strings' })
  communityMusicGenres?: string[];

  @ApiPropertyOptional({
    name: 'communityThemeTopics',
    type: 'string',
    isArray: true,
    enum: CommunityThemeTopics,
  })
  @IsOptional()
  @IsString({ each: true })
  @IsArray({ message: 'communityThemeTopics must be an array of strings' })
  communityThemeTopics?: string[];

  @ApiPropertyOptional({
    name: 'creatorMusicGenres',
    type: 'string',
    isArray: true,
    enum: CreatorMusicGenres,
  })
  @IsOptional()
  @IsString({ each: true })
  @IsArray({ message: 'creatorMusicGenres must be an array of strings' })
  creatorMusicGenres?: string[];

  @ApiPropertyOptional({
    name: 'creatorContentFocus',
    type: 'string',
    isArray: true,
    enum: CreatorContentFocus,
  })
  @IsOptional()
  @IsString({ each: true })
  @IsArray({ message: 'creatorContentFocus must be an array of strings' })
  creatorContentFocus?: string[];

  @ApiPropertyOptional({
    name: 'musicGenresFilterMethod',
    enum: ['and', 'or'],
  })
  @IsOptional()
  @IsEnum(['and', 'or'], {
    message: 'musicGenresFilterMethod must be either "and" or "or"',
  })
  musicGenresFilterMethod?: 'and' | 'or';

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
