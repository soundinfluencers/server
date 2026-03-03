import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {ApiProperty} from "@nestjs/swagger";
import {IsObject, IsOptional, IsString} from "class-validator";
import {CreateSocialAccountDto} from "../../../modules/auth/dto/create-influencer.dto";

// dto for building email template about some influencer requesting to change price for one of his social accounts
export class BuildChangePriceRequestTemplateDto {
    // influencer info
    influencerName: string;
    influencerEmail: string;

    // social account info
    accountUsername: string;
    accountSocialMedia: SocialMediaEnum;

    // prices
    oldPrice: number;
    newPrice: number;

    // links
    acceptLink: string;
    declineLink: string;
}

// dto for building email template about new influencer signed up
export class BuildInfluencerSignupRequestTemplateDto {
    @ApiProperty()
    @IsString()
    firstName: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    lastName?: string;

    @ApiProperty()
    @IsString()
    email: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsObject()
    socialAccounts?: Partial<Record<SocialMediaEnum, CreateSocialAccountDto[]>>;

    @ApiProperty()
    @IsString()
    acceptLink: string;

    @ApiProperty()
    @IsString()
    declineLink: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    negotiateLink?: string;

    @ApiProperty({ required: false, default: 'SoundInfluencers' })
    @IsOptional()
    @IsString()
    brandName?: string;
}
