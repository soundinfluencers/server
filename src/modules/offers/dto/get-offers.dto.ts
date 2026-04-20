import {ApiProperty} from "@nestjs/swagger";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {IsEnum} from "class-validator";
import {FoundAccountDto} from "../../profile/dto/influencer/get-profile.dto";

const allowedGenres = [
    'Techno (Melodic, Minimal)',
    'Techno (Hard, Peak)',
    'House (Tech House)',
    'House (Melodic, Afro)',
    'EDM',
    'D&B',
    'Bass',
    'Psy',
    'Trance',
    'Dubstep',
    'Garage',
    'Dance Pop',
]

export class GetFilteredPublishedOffers {
    @ApiProperty({
        name: 'socialMedia',
        type: 'string',
        enum: SocialMediaEnum,
        required: true
    })
    @IsEnum(SocialMediaEnum)
    socialMedia: SocialMediaEnum;

    // todo: создать кастомный валидатор и декоратор, которые будут проверять наличие жанра в соц. сети
    @ApiProperty({
        name: 'genre',
        type: 'string',
        enum: [
            'Techno (Melodic, Minimal)',
            'Techno (Hard, Peak)',
            'House (Tech House)',
            'House (Melodic, Afro)',
            'EDM',
            'D&B',
            'Bass',
            'Psy',
            'Trance',
            'Dubstep',
            'Garage',
            'Dance Pop',
        ],
        required: true
    })
    @IsEnum(allowedGenres)
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
    networksAmount?: number;

    @ApiProperty()
    storyAndPostDetails?: string;
}