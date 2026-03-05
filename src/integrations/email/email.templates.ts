import {BuildInvoiceEmailDto} from "./dto/templates/invoice-email.dto";
import {EmailMessage} from "./types/email.types";
import {
    buildClientCampaignInvoiceTemplate,
    buildInfluencerInvoiceEmail,
    buildInfluencerInvoiceResponseEmail
} from "./builders/invoice-email.template";
import {
    BuildChangePriceRequestTemplateDto,
    BuildInfluencerSignupRequestTemplateDto
} from "./dto/templates/profile-email.dto";
import {
    buildInfluencerSignupAutoReplyTemplate,
    buildInfluencerSignupRequestTemplate,
    buildPriceChangeRequestTemplate
} from "./builders/profile-email.template";
import {
    BuildClientCreatedCampaignTemplateDto,
    BuildInfluencerNewPromoRequestTemplateDto, BuildRequestEditTemplateDto
} from "./dto/templates/campaign-email.dto";
import {
    buildClientCreatedCampaignTemplate,
    buildInfluencerNewPromoRequestTemplate, buildNewBespokeCampaignRequestTemplate, buildRequestEditTemplate
} from "./builders/campaign-email.template";
import {CreateBespokeCampaignDto} from "../../modules/campaigns/dto/bespoke-request.dto";
import {ForgotPasswordEmailDto, NewPasswordEmailDto} from "./dto/templates/forgot-email.dto";
import {buildForgotPasswordEmailTemplate, buildNewPasswordEmailTemplate} from "./builders/forgot-email.template";

const ADMIN_EMAIL = process.env.EMAIL_USER;

// Emails from to us about influencer side updates
export const InfluencerToAdminEmails = {
    newInvoice: (data: BuildInvoiceEmailDto, pdf: Buffer): EmailMessage => ({
        to: ADMIN_EMAIL,
        subject: `Invoice from ${data.influencerEmail}`,
        html: buildInfluencerInvoiceEmail(data),
        attachments: [
            { filename: 'invoice.pdf', content: pdf, contentType: 'application/pdf' },
        ],
    }),

    priceChangeRequest: (data: BuildChangePriceRequestTemplateDto): EmailMessage => ({
        to: ADMIN_EMAIL,
        subject: 'Price change request',
        html: buildPriceChangeRequestTemplate(data),
    }),

    influencerSignup: (data: BuildInfluencerSignupRequestTemplateDto): EmailMessage => ({
        to: ADMIN_EMAIL,
        subject: 'Verify new influencer',
        html: buildInfluencerSignupRequestTemplate(data),
    })
} as const;

// Emails from us to influencers
export const AdminToInfluencerEmails = {
    newPromoRequest: (data: BuildInfluencerNewPromoRequestTemplateDto): EmailMessage => ({
        // to: data.email,
        to: ADMIN_EMAIL,
        subject: 'New promo request',
        html: buildInfluencerNewPromoRequestTemplate(data),
    }),

    invoiceInvoiceReceivedAutoReply: (to: string = ADMIN_EMAIL): EmailMessage => ({
        to,
        subject: 'SoundInfluencers',
        html: buildInfluencerInvoiceResponseEmail(),
    }),

    influencerSignupAutoReply: (to: string = ADMIN_EMAIL, firstName: string): EmailMessage => ({
        to,
        subject: 'SoundInfluencers',
        html: buildInfluencerSignupAutoReplyTemplate(to, firstName),
    })

} as const;

// Emails from to us about client side updates
export const ClientToAdminEmails = {
    campaignCreated: (data: BuildClientCreatedCampaignTemplateDto): EmailMessage => ({
        to: ADMIN_EMAIL,
        subject: 'Client created campaign',
        html: buildClientCreatedCampaignTemplate(data),
    }),

    bespokeCampaignRequest: (
        data: CreateBespokeCampaignDto & { clientName?: string; clientEmail?: string }
    ): EmailMessage => ({
        to: ADMIN_EMAIL,
        subject: 'Bespoke campaign request',
        html: buildNewBespokeCampaignRequestTemplate(data),
    }),

    campaignEditRequest: (data: BuildRequestEditTemplateDto): EmailMessage => ({
        to: ADMIN_EMAIL,
        subject: 'Campaign edit request',
        html: buildRequestEditTemplate(data),
    }),
} as const;

// Emails from us to clients
export const AdminToClientEmails = {
    campaignInvoice: (to: string, pdf: Buffer): EmailMessage => ({
        to,
        subject: 'Campaign invoice',
        html: buildClientCampaignInvoiceTemplate(),
        attachments: [
            { filename: 'invoice.pdf', content: pdf, contentType: 'application/pdf' },
        ],
    }),

    // Forgot password
    forgotPassword: (data: ForgotPasswordEmailDto): EmailMessage => ({
        // to: data.email,
        to: ADMIN_EMAIL,
        subject: 'Reset password',
        html: buildForgotPasswordEmailTemplate(data),
    }),

    // New password
    newPassword: (data: NewPasswordEmailDto): EmailMessage => ({
        // to: data.email,
        to: ADMIN_EMAIL,
        subject: 'New password',
        html: buildNewPasswordEmailTemplate(data),
    }),
} as const;