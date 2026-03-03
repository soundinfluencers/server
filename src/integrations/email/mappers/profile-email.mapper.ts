import {CreateInfluencerDto, CreateSocialAccountDto} from "../../../modules/auth/dto/create-influencer.dto";
import {BuildInfluencerSignupRequestTemplateDto} from "../dto/profile-email.dto";
import {SocialMediaEnum} from "../../../common/types/social-media.types";

type SignupMapperOptions = {
    acceptLink: string;
    declineLink: string;
    negotiateLink?: string;
    brandName?: string;
};

export function mapCreateInfluencerToSignupEmailDto(
    dto: CreateInfluencerDto,
    options: SignupMapperOptions
): BuildInfluencerSignupRequestTemplateDto {

    const socialAccounts: Partial<Record<SocialMediaEnum, CreateSocialAccountDto[]>> = {};

    const possibleNetworks: SocialMediaEnum[] = [
        SocialMediaEnum.instagram,
        SocialMediaEnum.tiktok,
        SocialMediaEnum.spotify,
        SocialMediaEnum.soundcloud,
        SocialMediaEnum.facebook,
        SocialMediaEnum.youtube,
        SocialMediaEnum.press,
    ];

    for (const network of possibleNetworks) {
        const accounts = (dto as any)[network] as CreateSocialAccountDto[] | undefined;

        if (Array.isArray(accounts) && accounts.length > 0) {
            socialAccounts[network] = accounts;
        }
    }

    return {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        socialAccounts,
        acceptLink: options.acceptLink,
        declineLink: options.declineLink,
        negotiateLink: options.negotiateLink,
        brandName: options.brandName ?? 'SoundInfluencers',
    };
}