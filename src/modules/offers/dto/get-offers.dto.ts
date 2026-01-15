import {ApiProperty} from "@nestjs/swagger";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {IsEnum} from "class-validator";

const allowedGenres = [
    'Techno (Melodic, Minimal)',
    'Techno (Hard, Peak)',
    'House (Tech House)',
    'House (Melodic, Afro)',
    'EDM',
    'D&B',
    'Bass',
    'Psy, Trance',
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
            'Psy, Trance',
            'Dubstep',
            'Garage',
            'Dance Pop',
        ],
        required: true
    })
    @IsEnum(allowedGenres)
    genre: string;
}