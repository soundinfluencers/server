import {SocialMediaEnum} from "../../../common/types/social-media.types";

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