import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {IsBoolean, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested} from 'class-validator';
import {Type} from 'class-transformer';
import {SocialMediaEnum} from '../../../../common/types/social-media.types';
import {allAllowedOfferGenres} from '../../../../common/types/genres.types';
import {IsGenreAllowedForSocialMedia} from '../../../../common/decorators/dto/genre-for-social-media.decorator';

export class GetAdminOffersMatrixQuery {
    @ApiPropertyOptional({type: String})
    @IsOptional()
    @IsString()
    offersCursor?: string;

    @ApiPropertyOptional({type: Number})
    @Type(() => Number)
    @IsOptional()
    @IsNumber()
    offersTake?: number;

    @ApiPropertyOptional({type: String})
    @IsOptional()
    @IsString()
    accountsCursor?: string;

    @ApiPropertyOptional({type: Number})
    @Type(() => Number)
    @IsOptional()
    @IsNumber()
    accountsTake?: number;

    @ApiProperty({type: String, enum: SocialMediaEnum})
    @IsEnum(SocialMediaEnum)
    socialMedia: SocialMediaEnum;

    @ApiProperty({
        type: String,
        enum: [...allAllowedOfferGenres],
        description: 'Must be allowed for the selected socialMedia (allowedGenresMap).',
    })
    @IsString()
    @IsNotEmpty()
    @IsGenreAllowedForSocialMedia()
    genre: string;
}

export class AdminOffersMatrixOfferHeaderDto {
    @ApiProperty()
    offerId: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    isPublished: boolean;

    @ApiProperty()
    price: number;

    @ApiProperty()
    createdAt: string;
}

export class AdminOffersMatrixAccountRowDto {
    @ApiProperty()
    influencerId: string;

    @ApiProperty()
    accountId: string;

    @ApiProperty()
    username: string;

    @ApiPropertyOptional()
    logoUrl?: string;
}

export class AdminOffersMatrixLinkDto {
    @ApiProperty()
    offerId: string;

    @ApiProperty()
    influencerId: string;

    @ApiProperty()
    accountId: string;
}

export class AdminOffersMatrixDto {
    @ApiProperty({type: () => [AdminOffersMatrixOfferHeaderDto]})
    @ValidateNested({each: true})
    @Type(() => AdminOffersMatrixOfferHeaderDto)
    offerHeaders: AdminOffersMatrixOfferHeaderDto[];

    @ApiPropertyOptional({type: String, nullable: true})
    offersNextCursor: string | null;

    @ApiProperty({type: () => [AdminOffersMatrixAccountRowDto]})
    @ValidateNested({each: true})
    @Type(() => AdminOffersMatrixAccountRowDto)
    accountRows: AdminOffersMatrixAccountRowDto[];

    @ApiPropertyOptional({type: String, nullable: true})
    accountsNextCursor: string | null;

    @ApiProperty({type: () => [AdminOffersMatrixLinkDto]})
    @ValidateNested({each: true})
    @Type(() => AdminOffersMatrixLinkDto)
    links: AdminOffersMatrixLinkDto[];
}

export class AdminOffersMatrixToggleLinkDto {
    @ApiProperty()
    @IsMongoId()
    offerId: string;

    @ApiProperty()
    @IsMongoId()
    influencerId: string;

    @ApiProperty()
    @IsMongoId()
    accountId: string;

    @ApiProperty({description: 'true = add account to offer, false = remove'})
    @IsBoolean()
    connected: boolean;
}

export enum OfferEditableField {
    title = 'title',
    price = 'price',
    combinedFollowers = 'combinedFollowers',
    networkAmount = 'networkAmount',
    storyAndPostDetails = 'storyAndPostDetails',
    isPublished = 'isPublished',
}

export class UpdateOfferFieldDto {
    @ApiProperty({
        enum: OfferEditableField,
        example: OfferEditableField.price,
    })
    @IsEnum(OfferEditableField)
    field: OfferEditableField;

    @ApiProperty({
        oneOf: [
            { type: 'string', example: 'New offer title' },
            { type: 'number', example: 150 },
            { type: 'boolean', example: true },
        ],
    })
    @IsNotEmpty()
    value: unknown;
}