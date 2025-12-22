import {ApiProperty} from '@nestjs/swagger';
import {ISocial, typesSocialMedia} from "../../auth/dto/create-influencer.dto";

export class UpdateInfluencerPersonalDetailsDto {
    _id: string;

    @ApiProperty({required: true})
    firstName: string;

    @ApiProperty({required: true})
    email: string;

    @ApiProperty({required: true})
    phone: string;
}

export class InfluencerUpdatedPersonalDetailsDto {
    @ApiProperty({required: true})
    firstName: string;

    @ApiProperty({required: true})
    email: string;

    @ApiProperty({required: true})
    phone: string;
}

export class UpdateSocialMediaAccountDto {
    @ApiProperty({required: true})
    _id: string;

    @ApiProperty({required: true})
    typeOfSocialMedia: string;

    @ApiProperty({required: true})
    accountId: string;

    @ApiProperty({required: false})
    oldUsername: string;

    @ApiProperty({required: true})
    instagramUsername: string;

    @ApiProperty({required: true})
    instagramLink: string;

    @ApiProperty({required: true})
    followersNumber: string;

    @ApiProperty({required: true})
    logo: string;

    @ApiProperty({required: true})
    price: string;

    @ApiProperty({required: true})
    publicPrice: string;

    @ApiProperty({required: true})
    currency: string;

    @ApiProperty({required: false})
    initialPrice: string;

    @ApiProperty({required: true})
    musicStyle: string;

    @ApiProperty({required: true})
    musicSubStyles: string[];

    @ApiProperty({required: true})
    musicStyleOther: string[];

    @ApiProperty({required: true})
    countries: { country: string; percentage: number }[];

    @ApiProperty({required: true})
    categories: string[];

    @ApiProperty({required: false})
    creatorCategories: string[];

    @ApiProperty({required: false})
    profileCategory: string;

    @ApiProperty({required: true})
    engagementRate: number | null;

    @ApiProperty({required: true})
    averageViews: number | null;

    @ApiProperty({required: false, default: false})
    canUpdatePrice: boolean;
}

export class AddSocialMediasDto {
    @ApiProperty()
    influencerId: string;

    @ApiProperty({
        type: 'array',
        items: {type: 'object', properties: typesSocialMedia},
    })
    instagram: ISocial[];

    @ApiProperty({
        type: 'array',
        items: {type: 'object', properties: typesSocialMedia},
    })
    tiktok: ISocial[];

    @ApiProperty({
        type: 'array',
        items: {type: 'object', properties: typesSocialMedia},
    })
    soundcloud: ISocial[];

    @ApiProperty({
        type: 'array',
        items: {type: 'object', properties: typesSocialMedia},
    })
    facebook: ISocial[];

    @ApiProperty({
        type: 'array',
        items: {type: 'object', properties: typesSocialMedia},
    })
    youtube: ISocial[];

    @ApiProperty({
        type: 'array',
        items: {type: 'object', properties: typesSocialMedia},
    })
    spotify: ISocial[];

    @ApiProperty({
        type: 'array',
        items: {type: 'object', properties: typesSocialMedia},
    })
    press: ISocial[];
}