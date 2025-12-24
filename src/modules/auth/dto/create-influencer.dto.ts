import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsArray, ValidateNested, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { InfluencerProfileCategory } from '../../../common/types/influencer/influencer.types';

class MusicGenreDto {
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

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    profileLink?: string;

    @ApiProperty({ type: Number, required: false })
    @IsOptional()
    @IsNumber()
    followers?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    logoUrl?: string;

    @ApiProperty({ enum: InfluencerProfileCategory, default: InfluencerProfileCategory.community })
    @IsEnum(InfluencerProfileCategory)
    profileCategory: InfluencerProfileCategory;

    @ApiProperty({ type: Number, required: false })
    @IsOptional()
    @IsNumber()
    price?: number;

    @ApiProperty({ type: Number, required: false })
    @IsOptional()
    @IsNumber()
    publicPrice?: number;

    @ApiProperty({ required: false, default: 'EUR' })
    @IsOptional()
    @IsString()
    currency?: string | null;

    @ApiProperty({ type: Number, required: false, default: 0 })
    @IsOptional()
    @IsNumber()
    initialPrice?: number;

    @ApiProperty({ type: Number, required: false })
    @IsOptional()
    @IsNumber()
    engagementRate?: number | null;

    @ApiProperty({ type: Number, required: false })
    @IsOptional()
    @IsNumber()
    averageViews?: number | null;

    @ApiProperty({ type: [MusicGenreDto], default: [] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MusicGenreDto)
    @IsOptional()
    musicGenres?: MusicGenreDto[];

    @ApiProperty({ type: [String], required: false, default: [] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    creatorCategories?: string[];

    @ApiProperty({ type: [CountryStatsDto], default: [] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CountryStatsDto)
    @IsOptional()
    countries?: CountryStatsDto[];

    @ApiProperty({ type: [String], required: false, default: [] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    categories?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isHidden?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isDeleted?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isVerified?: boolean;
}

export class CreateInfluencerDto {
    @ApiProperty()
    @IsString()
    firstName: string;

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

    @ApiProperty()
    @IsString()
    email: string;

    @ApiProperty()
    @IsString()
    phone: string;

    @ApiProperty()
    @IsString()
    password: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    internalNote?: string;
}
