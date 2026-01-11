import {Influencer, SocialAccount} from "../../database/schemas/users/influencer.schema";
import {
    InfluencerAccountDetailsDto,
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

        instagramAccounts: influencer?.instagram.map((acc: SocialAccount): SocialAccountForAccountDetailsDto => mapSocialAccountToAccountDetailsDto(acc)) ?? [],
        tiktokAccounts: influencer?.tiktok.map((acc: SocialAccount): SocialAccountForAccountDetailsDto => mapSocialAccountToAccountDetailsDto(acc)) ?? [],
        spotifyAccounts: influencer?.spotify.map((acc: SocialAccount): SocialAccountForAccountDetailsDto => mapSocialAccountToAccountDetailsDto(acc)) ?? [],
        youtubeAccounts: influencer?.youtube.map((acc: SocialAccount): SocialAccountForAccountDetailsDto => mapSocialAccountToAccountDetailsDto(acc)) ?? [],
        facebookAccounts: influencer?.facebook.map((acc: SocialAccount): SocialAccountForAccountDetailsDto => mapSocialAccountToAccountDetailsDto(acc)) ?? [],
        soundcloudAccounts: influencer?.soundcloud.map((acc: SocialAccount): SocialAccountForAccountDetailsDto => mapSocialAccountToAccountDetailsDto(acc)) ?? [],
        pressAccounts: influencer?.press.map((acc: SocialAccount): SocialAccountForAccountDetailsDto => mapSocialAccountToAccountDetailsDto(acc)) ?? [],
    }
};