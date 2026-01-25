import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import { SocialMediaEnum } from "../../../../common/types/social-media.types";
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
    Min
} from "class-validator";
import {InfluencerProfileCategory, SocialAccountSortByEnum} from "../../../../common/types/influencer/influencer.types";
import {Type} from "class-transformer";

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
        message: 'sortBy has invalid value'
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
        message: `socialMedias must contain only valid SocialMediaEnum values`
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
        message: 'profileTypes must contain only valid InfluencerProfileCategory values'
    })
    profileTypes?: InfluencerProfileCategory[];

    @ApiPropertyOptional({
        name: 'musicGenres',
        type: 'string',
        isArray: true,
    })
    @IsOptional()
    @IsString({ each: true })
    @IsArray({ message: 'musicGenres must be an array of strings' })
    musicGenres?: string[];

    @ApiPropertyOptional({
        name: 'musicGenresFilterMethod',
        enum: ['and', 'or']
    })
    @IsOptional()
    @IsEnum(['and', 'or'], {
        message: 'musicGenresFilterMethod must be either "and" or "or"'
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
        name: 'additionalTopics',
        type: 'string',
        isArray: true,
    })
    @IsOptional()
    @IsString({ each: true })
    @IsArray({ message: 'additionalTopics must be an array of strings' })
    additionalTopics?: string[];

    @ApiPropertyOptional({
        name: 'budget',
        type: 'number',
    })
    @Type(() => Number)
    @IsNumber({}, {
        message: 'budget must be a number'
    })
    @IsOptional()
    budget?: number;

    @ApiPropertyOptional({
        name: 'currency',
        enum: ['EUR', 'USD', 'GBP']
    })
    @IsOptional()
    @IsEnum(['EUR', 'USD', 'GBP'], {
        message: 'currency must be one of: EUR, USD, GBP'
    })
    currency?: 'EUR' | 'USD' | 'GBP';

    @ApiPropertyOptional({
        name: 'musicCategories',
        type: 'string',
        isArray: true,
    })
    @IsOptional()
    @IsString({ each: true })
    @IsArray({ message: 'musicCategories must be an array of strings' })
    musicCategories?: string[];

    @ApiPropertyOptional({
        name: 'entertainmentCategories',
        type: 'string',
        isArray: true,
    })
    @IsString({ each: true })
    @IsOptional()
    @IsArray({ message: 'entertainmentCategories must be an array of strings' })
    entertainmentCategories?: string[];
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