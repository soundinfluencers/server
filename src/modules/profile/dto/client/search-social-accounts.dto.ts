import {ApiPropertyOptional} from "@nestjs/swagger";
import {SocialMediaEnum} from "../../../../common/types/social-media.types";
import {IsArray, IsEnum, IsNumber, IsOptional} from "class-validator";
import {InfluencerProfileCategory} from "../../../../common/types/influencer/influencer.types";

export class SocialAccountSearchFiltersDto {
    @ApiPropertyOptional({
        name: 'socialMedias',
        isArray: true,
        enum: SocialMediaEnum,
    })
    @IsArray()
    @IsEnum(SocialMediaEnum, {each: true})
    @IsOptional()
    socialMedias?: SocialMediaEnum[];

    @ApiPropertyOptional({
        name: 'profileTypes',
        isArray: true,
        enum: InfluencerProfileCategory,
    })
    @IsArray()
    @IsEnum(InfluencerProfileCategory, {each: true})
    @IsOptional()
    profileTypes?: InfluencerProfileCategory[];

    @ApiPropertyOptional({
        name: 'musicGenres',
        type: 'string',
        isArray: true,
    })
    @IsArray()
    @IsOptional()
    musicGenres?: string[]; // musicGenres = influencer.account.musicGenres

    @ApiPropertyOptional({
        name: 'musicGenresFilterMethod',
        enum: ['and', 'or']
    })
    @IsEnum(['and', 'or'], {each: true})
    @IsOptional()
    musicGenresFilterMethod?: string; // method for filtering social accounts music genres

    @ApiPropertyOptional({
        name: 'countries',
        type: 'string',
        isArray: true,
    })
    @IsArray()
    @IsOptional()
    countries?: string[]; // countries = influencer.account.countries

    @ApiPropertyOptional({
        name: 'additionalTopics',
        type: 'string',
        isArray: true,
    })
    @IsArray()
    @IsOptional()
    additionalTopics?: string[]; // additionalTopics = influencer.account.categories

    @ApiPropertyOptional({
        name: 'budget',
        type: 'number',
    })
    @IsNumber()
    @IsOptional()
    budget?: number;

    @ApiPropertyOptional({
        name: 'currency',
        enum: ['£', '$', '€']
    })
    @IsEnum(['£', '$', '€'], {each: true})
    @IsOptional()
    currency?: string;

    // music categories + entertainment categories = influencer.account.creatorCategories
    @ApiPropertyOptional({
        name: 'musicCategories',
        type: 'string',
        isArray: true,
    })
    @IsArray()
    @IsOptional()
    musicCategories?: string[];

    @ApiPropertyOptional({
        name: 'entertainmentCategories',
        type: 'string',
        isArray: true,
    })
    @IsArray()
    @IsOptional()
    entertainmentCategories?: string[];
}