import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {IsString, IsOptional, IsArray, ValidateNested, IsEnum, IsNumber, IsBoolean} from 'class-validator';
import {Type} from 'class-transformer';
import {
    AdminCreateSocialAccountDto,
    CreateSocialAccountDto,
    MusicGenreDto
} from "../../../auth/dto/create-influencer.dto";
import {SocialMediaEnum, SocialMediaType} from "../../../../common/types/social-media.types";
import {InfluencerCountryStats, SocialAccount} from "../../../../database/schemas/users/influencer.schema";
import {InfluencerProfileCategory} from "../../../../common/types/influencer/influencer.types";
import {CurrencyCode} from "../../../../common/types/finance.types";

// DTO for updating personal details
export class UpdateInfluencerPersonalDto {
    @ApiPropertyOptional({description: "Influencer's updated first name", example: "Eric"})
    @IsOptional()
    @IsString()
    firstName: string;

    @ApiPropertyOptional({description: "Influencer's updated logo url"})
    @IsOptional()
    @IsString()
    logoUrl: string;

    @ApiPropertyOptional({description: "Influencer's updated last name", example: "Ericovich"})
    @IsOptional()
    @IsString()
    lastName: string;

    @ApiPropertyOptional({description: "Influencer's updated email", example: "test@gmail.com"})
    @IsOptional()
    @IsString()
    email: string;

    @ApiPropertyOptional({description: "Influencer's updated phone number", example: "+999999"})
    @IsOptional()
    @IsString()
    phone: string;
}

// result of updating personal details
export class InfluencerUpdatedPersonalDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    firstName: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    lastName: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    logoUrl: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    email: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    phone: string;
}

// DTO for adding new social accounts
export class AddSocialAccountDto {
    influencerId: string;

    @ApiProperty({type: String, required: true, enum: SocialMediaEnum})
    @IsEnum(SocialMediaEnum)
    socialMedia: SocialMediaEnum;

    @ApiProperty({ type: () => CreateSocialAccountDto, required: true })
    @ValidateNested()
    @Type(() => CreateSocialAccountDto)
    payload: CreateSocialAccountDto | AdminCreateSocialAccountDto;
}

// DTO for updating one social account
export class UpdateSocialAccountDto {
    influencerId: string;

    @ApiPropertyOptional({ description: "Social account ID", example: "66a747a89c6e78a6cfb83g5" })
    @IsString()
    accountId: string;

    @ApiPropertyOptional({ description: "Social media type", example: "instagram", enum: SocialMediaEnum })
    @IsEnum(SocialMediaEnum)
    socialMedia: SocialMediaEnum;

    @ApiPropertyOptional({ description: "Username of the account", example: "techno_tv" })
    @IsOptional()
    @IsString()
    username?: string;

    @ApiPropertyOptional({ description: "Profile link URL", example: "https://instagram.com/techno_tv" })
    @IsOptional()
    @IsString()
    profileLink?: string;

    @ApiPropertyOptional({ description: "Number of followers", example: 12000 })
    @IsOptional()
    @IsNumber()
    followers?: number;

    @ApiPropertyOptional({ description: "Logo URL", example: "https://logo.url/logo.png" })
    @IsOptional()
    @IsString()
    logoUrl?: string;

    @ApiPropertyOptional({ description: "Price", example: 50 })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    price?: number;

    @ApiPropertyOptional({example: 'EUR', enum: CurrencyCode})
    @IsOptional()
    @IsEnum(CurrencyCode)
    currency?: CurrencyCode;

    @ApiPropertyOptional({ description: "Engagement rate", example: 5.3 })
    @IsOptional()
    @IsNumber()
    engagementRate?: number;

    @ApiPropertyOptional({ description: "Average views", example: 1000 })
    @IsOptional()
    @IsNumber()
    averageViews?: number;

    @ApiPropertyOptional({ type: MusicGenreDto, isArray: true })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MusicGenreDto)
    musicGenres?: MusicGenreDto[];

    @ApiPropertyOptional({ type: [String], description: "Creator categories" })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    creatorCategories?: string[];

    @ApiPropertyOptional({ type: [InfluencerCountryStats], description: "Country stats" })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => InfluencerCountryStats)
    countries?: InfluencerCountryStats[];

    @ApiPropertyOptional({ type: [String], description: "Categories" })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    categories?: string[];

    @ApiPropertyOptional({ enum: InfluencerProfileCategory, description: "Profile category" })
    @IsOptional()
    @IsEnum(InfluencerProfileCategory)
    profileCategory?: InfluencerProfileCategory;
}

// dto for deleting social account
export class DeleteSocialAccountDto {
    influencerId: string;

    @ApiPropertyOptional({ description: "Social account ID", example: "66a747a89c6e78a6cfb83g5" })
    @IsString()
    accountId: string;

    @ApiPropertyOptional({ description: "Social media type", example: "instagram", enum: SocialMediaEnum })
    @IsEnum(SocialMediaEnum)
    socialMedia: SocialMediaEnum;

    @ApiPropertyOptional({
        example: "Account is deprecated",
    })
    @IsString()
    @IsOptional()
    deleteReason?: string;
}