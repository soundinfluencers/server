import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {IsString, IsOptional, IsArray, ValidateNested, IsEnum, IsNumber, IsBoolean} from 'class-validator';
import {Type} from 'class-transformer';
import {CreateSocialAccountDto, MusicGenreDto} from "../../../auth/dto/create-influencer.dto";
import {SocialMediaEnum, SocialMediaType} from "../../../../common/types/social-media.types";
import {InfluencerCountryStats, SocialAccount} from "../../../../database/schemas/users/influencer.schema";
import {InfluencerProfileCategory} from "../../../../common/types/influencer/influencer.types";

// DTO for updating personal details
export class UpdateInfluencerPersonalDetailsDto {
    influencerId: string;

    @ApiPropertyOptional({description: "Influencer's updated first name", example: "Eric"})
    @IsOptional()
    @IsString()
    firstName: string;

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
export class InfluencerUpdatedPersonalDetailsDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    firstName: string;

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
export class AddSocialMediasDto {
    influencerId: string;

    @ApiProperty({type: [CreateSocialAccountDto], required: false})
    @IsArray()
    @ValidateNested({each: true})
    @Type(() => CreateSocialAccountDto)
    @IsOptional()
    instagram?: CreateSocialAccountDto[];

    @ApiProperty({type: [CreateSocialAccountDto], required: false})
    @IsArray()
    @ValidateNested({each: true})
    @Type(() => CreateSocialAccountDto)
    @IsOptional()
    tiktok?: CreateSocialAccountDto[];

    @ApiProperty({type: [CreateSocialAccountDto], required: false})
    @IsArray()
    @ValidateNested({each: true})
    @Type(() => CreateSocialAccountDto)
    @IsOptional()
    spotify?: CreateSocialAccountDto[];

    @ApiProperty({type: [CreateSocialAccountDto], required: false})
    @IsArray()
    @ValidateNested({each: true})
    @Type(() => CreateSocialAccountDto)
    @IsOptional()
    soundcloud?: CreateSocialAccountDto[];

    @ApiProperty({type: [CreateSocialAccountDto], required: false})
    @IsArray()
    @ValidateNested({each: true})
    @Type(() => CreateSocialAccountDto)
    @IsOptional()
    facebook?: CreateSocialAccountDto[];

    @ApiProperty({type: [CreateSocialAccountDto], required: false})
    @IsArray()
    @ValidateNested({each: true})
    @Type(() => CreateSocialAccountDto)
    @IsOptional()
    youtube?: CreateSocialAccountDto[];

    @ApiProperty({type: [CreateSocialAccountDto], required: false})
    @IsArray()
    @ValidateNested({each: true})
    @Type(() => CreateSocialAccountDto)
    @IsOptional()
    press?: CreateSocialAccountDto[];
}

// DTO for updating one social account
export class UpdateSocialMediaAccountDto {
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

    // @ApiPropertyOptional({ description: "Price", example: 50 })
    // @IsOptional()
    // @IsNumber()
    // price?: number;
    //
    // @ApiPropertyOptional({ description: "Public price", example: 55 })
    // @IsOptional()
    // @IsNumber()
    // publicPrice?: number;

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

    // @ApiPropertyOptional({ description: "Hidden flag" })
    // @IsOptional()
    // @IsBoolean()
    // isHidden?: boolean;
    //
    // @ApiPropertyOptional({ description: "Deleted flag" })
    // @IsOptional()
    // @IsBoolean()
    // isDeleted?: boolean;
    //
    // @ApiPropertyOptional({ description: "Verified flag" })
    // @IsOptional()
    // @IsBoolean()
    // isVerified?: boolean;
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