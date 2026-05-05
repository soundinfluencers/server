import {ApiProperty} from "@nestjs/swagger";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {IsEnum, IsNotEmpty, IsString} from "class-validator";
import {FoundAccountDto} from "../../profile/dto/influencer/get-profile.dto";
import {allAllowedOfferGenres} from "../../../common/types/genres.types";
import {IsGenreAllowedForSocialMedia} from "../../../common/decorators/dto/genre-for-social-media.decorator";

export class GetFilteredPublishedOffers {
    @ApiProperty({
        name: 'socialMedia',
        type: 'string',
        enum: SocialMediaEnum,
        required: true
    })
    @IsEnum(SocialMediaEnum)
    socialMedia: SocialMediaEnum;

    @ApiProperty({
        name: 'genre',
        type: 'string',
        enum: [...allAllowedOfferGenres],
        required: true,
        description: 'Must be one of the genres allowed for the selected socialMedia (see allowedGenresMap).',
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

    @ApiProperty()
    socialMedia: SocialMediaEnum;

    @ApiProperty({type: () => [FoundAccountDto]})
    connectedAccounts: FoundAccountDto[];

    @ApiProperty()
    price: number

    @ApiProperty()
    genre?: string;

    @ApiProperty()
    combinedFollowers?: string;

    @ApiProperty()
    networksAmount?: string;

    @ApiProperty()
    storyAndPostDetails?: string;
}