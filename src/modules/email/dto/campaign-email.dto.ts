// dto for building 'request edit' email template
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {CampaignPaymentMethodEnum} from "../../../common/types/client/campaign.types";

export class BuildRequestEditTemplateDto {
    campaignId: string;
    clientId: string;

    campaignName: string;
    clientName: string;
    clientEmail: string;

    acceptLink: string;
    declineLink: string;
}

// dto for building 'client created campaign' email template
export class BuildClientCreatedCampaignTemplateDto {
    campaignId: string;
    clientId: string;

    campaignSocialMedia: SocialMediaEnum;
    paymentType: CampaignPaymentMethodEnum

    campaignName: string;
    clientName: string;
    clientEmail: string;

    acceptLink: string;
    declineLink: string;
}