// dto for building 'influencer invoice' email template
import {InvoicePaymentMethodEnum} from "../../../../common/types/invoice.types";

export class BuildInvoiceEmailDto {
    influencerEmail: string;
    instagramAccounts: string;
    tiktokAccounts: string;
    spotifyAccounts: string;
    soundcloudAccounts: string;
    facebookAccounts: string;
    youtubeAccounts: string;
    pressAccounts: string;
    selectedPaymentMethod: InvoicePaymentMethodEnum;
}
