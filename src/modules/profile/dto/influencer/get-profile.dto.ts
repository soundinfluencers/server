import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {
    InfluencerAccountDetails, InfluencerProfileCategory, SocialAccountDetails,
    SocialAccountForAccountDetails
} from "../../../../common/types/influencer/influencer.types";
import {ClientAccountDetails} from "../../../../common/types/client/client.types";
import {
    InfluencerCountryStats,
    InfluencerMusicGenre,
    UserNotificationMethods
} from "../../../../database/schemas/users/influencer.schema";
import {SocialMediaEnum} from "../../../../common/types/social-media.types";
import {IsEnum, IsString} from "class-validator";
import {InfluencerConfirmationStatusEnum} from "../../../../common/types/influencer/promo.types";

export class SocialAccountForAccountDetailsDto implements SocialAccountForAccountDetails {
    @ApiProperty({
        description: "Social account's ID",
        example: '66a747a89c6e78a6cfb83g5',
    })
    accountId: string;

    @ApiProperty({
        description: "Social account's username",
        example: 'Techno TV',
    })
    username: string;

    @ApiProperty({
        example: 'wait',
        enum: InfluencerConfirmationStatusEnum
    })
    agreementStatus: InfluencerConfirmationStatusEnum;
}

// dto for getting influencer's profile details
export class InfluencerAccountDetailsDto implements InfluencerAccountDetails {
    @ApiProperty({example: 'John'})
    firstName: string;

    @ApiPropertyOptional({example: 'Doe'})
    lastName?: string;

    @ApiPropertyOptional({type: String})
    logoUrl?: string;

    @ApiProperty({example: 'john.doe@gmail.com'})
    email: string;

    @ApiProperty({example: '+380501234567'})
    phone: string;

    @ApiProperty({type: () => UserNotificationMethods})
    notificationMethods: UserNotificationMethods;

    @ApiProperty({
        type: [SocialAccountForAccountDetailsDto],
        description: 'Instagram accounts',
    })
    instagram: SocialAccountForAccountDetailsDto[];

    @ApiProperty({
        type: [SocialAccountForAccountDetailsDto],
        description: 'TikTok accounts',
    })
    tiktok: SocialAccountForAccountDetailsDto[];

    @ApiProperty({
        type: [SocialAccountForAccountDetailsDto],
        description: 'Spotify accounts',
    })
    spotify: SocialAccountForAccountDetailsDto[];

    @ApiProperty({
        type: [SocialAccountForAccountDetailsDto],
        description: 'YouTube accounts',
    })
    youtube: SocialAccountForAccountDetailsDto[];

    @ApiProperty({
        type: [SocialAccountForAccountDetailsDto],
        description: 'Facebook accounts',
    })
    facebook: SocialAccountForAccountDetailsDto[];

    @ApiProperty({
        type: [SocialAccountForAccountDetailsDto],
        description: 'SoundCloud accounts',
    })
    soundcloud: SocialAccountForAccountDetailsDto[];

    @ApiProperty({
        type: [SocialAccountForAccountDetailsDto],
        description: 'Press accounts',
    })
    press: SocialAccountForAccountDetailsDto[];

    @ApiPropertyOptional({
        description: "Influencer's telegram username",
        example: '@techno_tv',
    })
    telegramUsername?: string;
}

// dto for getting client's profile details
export class ClientAccountDetailsDto implements ClientAccountDetails {
    @ApiProperty({example: 'John'})
    firstName: string;

    @ApiPropertyOptional({example: 'Doe'})
    lastName?: string;

    @ApiPropertyOptional({type: String})
    logoUrl?: string;

    @ApiProperty({example: 'Techno TV Company'})
    companyName: string;

    @ApiProperty({example: 'john.doe@gmail.com'})
    email: string;

    @ApiProperty({example: '+380501234567'})
    phone: string;

    @ApiPropertyOptional({type: Boolean})
    isProposal?: boolean;
}

// query dto for getting detailed social account
export class GetSocialAccountDetailsParamsDto {
    @ApiProperty({example: '66a747a89c6e78a6cfb83g5'})
    @IsString()
    accountId: string;

    @ApiProperty({
        enum: SocialMediaEnum,
        example: 'instagram'
    })
    @IsEnum(SocialMediaEnum)
    socialMedia: SocialMediaEnum;

    influencerId?: string;
}

// dto for getting detailed social account
export class SocialAccountDetailsDto implements SocialAccountDetails {
    @ApiProperty({example: '66a747a89c6e78a6cfb83g5'})
    accountId: string;

    @ApiProperty({example: 'Techno TV'})
    username: string;

    @ApiProperty({example: 'https://instagram.com/technotv'})
    profileLink: string;

    @ApiProperty({example: 12000})
    followers: number;

    @ApiProperty({example: 'https://cdn.example.com/logo.png'})
    logoUrl: string;

    @ApiProperty({example: 'music', enum: InfluencerProfileCategory})
    profileCategory: InfluencerProfileCategory;

    @ApiProperty({example: 60})
    price: number;

    @ApiProperty({example: 'EUR', nullable: true})
    currency: string | null;

    @ApiProperty({isArray: true})
    musicGenres: InfluencerMusicGenre[];

    @ApiProperty({example: ['DJ', 'Producer'], isArray: true})
    creatorCategories: string[];

    @ApiProperty({example: [{country: 'US', percentage: 60}, {country: 'DE', percentage: 40}], isArray: true})
    countries: InfluencerCountryStats[];

    @ApiProperty({example: ['Music', 'Entertainment'], isArray: true})
    categories: string[];
}

// dto for returning found social accounts
export class FoundAccountDto {
    @ApiProperty({example: '66a747a89c6e78a6cfb83g5'})
    accountId: string;

    @ApiProperty({example: '66a747a89c6e78a6cfb83g5'})
    influencerId: string;

    @ApiProperty({example: 'Techno TV'})
    username: string;

    @ApiProperty({example: 'https://cdn.example.com/logo.png'})
    logoUrl: string;

    @ApiProperty({example: 12000})
    followers: number;

    @ApiProperty()
    prices: {
        'EUR': number;
        'USD': number;
        'GBP': number;
    }; // publicPrice of account (NOT DEFAULT PRICE)

    @ApiProperty({example: 'instagram', enum: SocialMediaEnum})
    socialMedia: SocialMediaEnum;

    @ApiProperty()
    countries: {
        country: string,
        percentage: number
    }[];

    @ApiPropertyOptional()
    musicGenres?: string[]; // FORMATTED music genres (InfluencerMusicGenre[] -> string[])

    @ApiPropertyOptional()
    creatorCategories?: string[];

    @ApiPropertyOptional()
    categories?: string[];
}

export class FoundAccountsDto {
    @ApiProperty({type: FoundAccountDto, isArray: true})
    accounts: FoundAccountDto[];
}

// account for agreement list
class AgreementAccountDto {
    @ApiProperty()
    username: string;

    @ApiProperty()
    price: number;
}

// dto response for getting social accounts list that need influencer's agreement
export class AgreementAccountsListDto {
    @ApiProperty({enum: ['profileCreate', 'accountAdd']})
    agreementType: 'profileCreate' | 'accountAdd';

    @ApiPropertyOptional({type: () => [AgreementAccountDto]})
    instagram?: AgreementAccountDto[];

    @ApiPropertyOptional({type: () => [AgreementAccountDto]})
    tiktok?: AgreementAccountDto[];

    @ApiPropertyOptional({type: () => [AgreementAccountDto]})
    facebook?: AgreementAccountDto[];

    @ApiPropertyOptional({type: () => [AgreementAccountDto]})
    youtube?: AgreementAccountDto[];

    @ApiPropertyOptional({type: () => [AgreementAccountDto]})
    spotify?: AgreementAccountDto[];

    @ApiPropertyOptional({type: () => [AgreementAccountDto]})
    soundcloud?: AgreementAccountDto[];

    @ApiPropertyOptional({type: () => [AgreementAccountDto]})
    press?: AgreementAccountDto[];
}