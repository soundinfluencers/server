import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsBoolean,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CommunityMusicGenres,
  CommunityThemeTopics,
  CreatorContentFocus,
  CreatorMusicGenres,
  InfluencerProfileCategory,
} from '../../../common/types/influencer/influencer.types';
import { CurrencyCode, CurrencyMeta } from '../../../common/types/finance.types';

class CountryStatsDto {
  @ApiProperty()
  @IsString()
  country: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number;
}

export class CreateSocialAccountDto {
  @ApiProperty()
  @IsString()
  username: string;

  @ApiProperty({ required: true })
  @IsString()
  profileLink: string;

  @ApiProperty({ type: Number, required: true })
  @IsNumber()
  followers: number;

  @ApiProperty({ required: true })
  @IsString()
  logoUrl: string;

  @ApiProperty({ enum: InfluencerProfileCategory, default: InfluencerProfileCategory.community })
  @IsEnum(InfluencerProfileCategory)
  profileCategory: InfluencerProfileCategory;

  @ApiProperty({ type: Number, required: true })
  @IsNumber()
  price: number;

  @ApiProperty({ required: true, enum: CurrencyCode })
  @IsEnum(CurrencyCode)
  currency: CurrencyCode;

  @ApiProperty({ type: [CountryStatsDto], required: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CountryStatsDto)
  countries: CountryStatsDto[];

  @ApiPropertyOptional({ type: String, isArray: true, enum: CommunityMusicGenres })
  @IsOptional()
  @IsArray()
  @ValidateIf(
    (obj: CreateSocialAccountDto) => obj.profileCategory === InfluencerProfileCategory.community,
  )
  communityMusicGenres?: CommunityMusicGenres[];

  @ApiPropertyOptional({ type: String, isArray: true, enum: CommunityThemeTopics })
  @IsOptional()
  @IsArray()
  @ValidateIf(
    (obj: CreateSocialAccountDto) => obj.profileCategory === InfluencerProfileCategory.community,
  )
  communityThemeTopics?: CommunityThemeTopics[];

  @ApiPropertyOptional({ type: String, isArray: true, enum: CreatorMusicGenres })
  @IsOptional()
  @IsArray()
  @ValidateIf(
    (obj: CreateSocialAccountDto) => obj.profileCategory === InfluencerProfileCategory.creator,
  )
  creatorMusicGenres?: CreatorMusicGenres[];

  @ApiPropertyOptional({ type: String, isArray: true, enum: CreatorContentFocus })
  @IsOptional()
  @IsArray()
  @ValidateIf(
    (obj: CreateSocialAccountDto) => obj.profileCategory === InfluencerProfileCategory.creator,
  )
  creatorContentFocus?: CreatorContentFocus[];
}

export class AdminCreateSocialAccountDto extends CreateSocialAccountDto {
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  engagementRate?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  averageViews?: number;
}

export class CreateInfluencerDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty()
  @IsString()
  email: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiProperty({ type: [CreateSocialAccountDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSocialAccountDto)
  @IsOptional()
  instagram?: CreateSocialAccountDto[];

  @ApiProperty({ type: [CreateSocialAccountDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSocialAccountDto)
  @IsOptional()
  tiktok?: CreateSocialAccountDto[];

  @ApiProperty({ type: [CreateSocialAccountDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSocialAccountDto)
  @IsOptional()
  spotify?: CreateSocialAccountDto[];

  @ApiProperty({ type: [CreateSocialAccountDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSocialAccountDto)
  @IsOptional()
  soundcloud?: CreateSocialAccountDto[];

  @ApiProperty({ type: [CreateSocialAccountDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSocialAccountDto)
  @IsOptional()
  facebook?: CreateSocialAccountDto[];

  @ApiProperty({ type: [CreateSocialAccountDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSocialAccountDto)
  @IsOptional()
  youtube?: CreateSocialAccountDto[];

  @ApiProperty({ type: [CreateSocialAccountDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSocialAccountDto)
  @IsOptional()
  press?: CreateSocialAccountDto[];
}
