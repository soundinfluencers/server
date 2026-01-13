import {Influencer, SocialAccount} from "../../database/schemas/users/influencer.schema";
import {
    InfluencerAccountDetailsDto, SocialAccountDetailsDto,
    SocialAccountForAccountDetailsDto
} from "../../modules/profile/dto/influencer/get-profile.dto";

// Maps social account doc to social account for account details dto
export const mapSocialAccountToAccountDetailsDto = (account: SocialAccount): SocialAccountForAccountDetailsDto => {
    return {
        accountId: account._id.toString(),
        username: account.username,
    }
};

// Maps influencer doc to influencer account details dto
export const mapInfluencerToAccountDetailsDto = (influencer: Influencer): InfluencerAccountDetailsDto => {
    return {
        firstName: influencer.firstName,
        email: influencer.email,
        phone: influencer.phone,

        instagram: influencer?.instagram.map((acc: SocialAccount): SocialAccountForAccountDetailsDto => mapSocialAccountToAccountDetailsDto(acc)) ?? [],
        tiktok: influencer?.tiktok.map((acc: SocialAccount): SocialAccountForAccountDetailsDto => mapSocialAccountToAccountDetailsDto(acc)) ?? [],
        spotify: influencer?.spotify.map((acc: SocialAccount): SocialAccountForAccountDetailsDto => mapSocialAccountToAccountDetailsDto(acc)) ?? [],
        youtube: influencer?.youtube.map((acc: SocialAccount): SocialAccountForAccountDetailsDto => mapSocialAccountToAccountDetailsDto(acc)) ?? [],
        facebook: influencer?.facebook.map((acc: SocialAccount): SocialAccountForAccountDetailsDto => mapSocialAccountToAccountDetailsDto(acc)) ?? [],
        soundcloud: influencer?.soundcloud.map((acc: SocialAccount): SocialAccountForAccountDetailsDto => mapSocialAccountToAccountDetailsDto(acc)) ?? [],
        press: influencer?.press.map((acc: SocialAccount): SocialAccountForAccountDetailsDto => mapSocialAccountToAccountDetailsDto(acc)) ?? [],
    }
};

// Maps social account doc to social account details dto
export const mapToSocialAccountDetailsDto = (account: SocialAccount): SocialAccountDetailsDto => {
    return {
        _id: account._id.toString(),
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