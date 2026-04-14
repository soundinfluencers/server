import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsArray, ValidateNested, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { InfluencerProfileCategory } from '../../../common/types/influencer/influencer.types';
import {CurrencyCode, CurrencyMeta} from "../../../common/types/finance.types";

export class MusicGenreDto {
    @ApiProperty()
    @IsString()
    genre: string;

    @ApiProperty({ type: [String], default: [] })
    @IsArray()
    @IsString({ each: true })
    subGenres: string[];
}

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

    @ApiProperty({ type: [MusicGenreDto], required: false })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MusicGenreDto)
    musicGenres?: MusicGenreDto[];

    @ApiProperty({ type: [String], required: false, default: [] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    creatorCategories?: string[];

    @ApiProperty({ type: [String], required: false, default: [] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    categories?: string[];
}

export class AdminCreateSocialAccountDto extends CreateSocialAccountDto {
    @ApiPropertyOptional({type: Number})
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    engagementRate?: number;

    @ApiPropertyOptional({type: Number})
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    averageViews?: number;
}

export class CreateInfluencerDto {
    @ApiProperty()
    @IsString()
    firstName: string;

    @ApiProperty()
    @IsString()
    lastName: string;

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
