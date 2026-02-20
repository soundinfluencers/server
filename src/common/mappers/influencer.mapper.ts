import {Influencer, SocialAccount} from "../../database/schemas/users/influencer.schema";
import {
    InfluencerAccountDetailsDto,
    SocialAccountDetailsDto,
    SocialAccountForAccountDetailsDto
} from "../../modules/profile/dto/influencer/get-profile.dto";
import {InfluencerConfirmationStatusEnum} from "../types/influencer/promo.types";

// Maps social account doc to social account for account details dto
export const mapSocialAccountToAccountDetailsDto = (account: SocialAccount): SocialAccountForAccountDetailsDto => {
    return {
        accountId: account._id.toString(),
        username: account.username,
        agreementStatus: account.agreementStatus ?? InfluencerConfirmationStatusEnum.accept
    }
};

// Filters deleted accounts
const filterSocialAccounts = (
    accounts?: SocialAccount[],
): SocialAccountForAccountDetailsDto[] => {
    return (
        accounts
            ?.filter(acc => !acc.isDeleted)
            .map(mapSocialAccountToAccountDetailsDto)
        ?? []
    );
};

// Maps influencer doc to influencer account details dto
export const mapInfluencerToAccountDetailsDto = (
    influencer: Influencer,
): InfluencerAccountDetailsDto => {
    return {
        firstName: influencer.firstName,
        lastName: influencer.lastName ?? null,
        logoUrl: influencer.logoUrl ?? null,
        email: influencer.email,
        phone: influencer.phone,
        notificationMethods: influencer.notificationMethods ?? {whatsapp: true, telegram: true},

        instagram: filterSocialAccounts(influencer.instagram),
        tiktok: filterSocialAccounts(influencer.tiktok),
        spotify: filterSocialAccounts(influencer.spotify),
        youtube: filterSocialAccounts(influencer.youtube),
        facebook: filterSocialAccounts(influencer.facebook),
        soundcloud: filterSocialAccounts(influencer.soundcloud),
        press: filterSocialAccounts(influencer.press),
    };
};

// Maps social account doc to social account details dto
export const mapToSocialAccountDetailsDto = (account: SocialAccount): SocialAccountDetailsDto => {
    return {
        accountId: account._id.toString(),
        username: account.username,
        profileLink: account.profileLink,
        followers: account.followers,
        logoUrl: account.logoUrl,
        profileCategory: account.profileCategory,
        price: account.price,
        currency: account.currency ?? 'EUR',
        musicGenres: account.musicGenres,
        creatorCategories: account.creatorCategories,
        countries: account.countries,
        categories: account.categories,
    }
};