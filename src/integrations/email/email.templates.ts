import {BuildInvoiceEmailDto} from "./dto/templates/invoice-email.dto";
import {EmailMessage} from "./types/email.types";
import {
    buildClientCampaignInvoiceTemplate,
    buildInfluencerInvoiceEmail,
    buildInfluencerInvoiceResponseEmail
} from "./builders/invoice-email.template";
import {
    BuildAccountNegotiationTemplateDto,
    BuildChangePriceRequestTemplateDto,
    BuildInfluencerSignupRequestTemplateDto
} from "./dto/templates/profile-email.dto";
import {
    buildClientApprovedEmailTemplate, buildClientDeclinedEmailTemplate, buildClientSignupRequestTemplate,
    buildInfluencerApprovedEmailTemplate, buildInfluencerDeclinedEmailTemplate,
    buildInfluencerSignupAutoReplyTemplate,
    buildInfluencerSignupRequestTemplate, buildPriceChangeApprovedEmailTemplate, buildPriceChangeDeclinedEmailTemplate,
    buildPriceChangeRequestTemplate, buildSocialAccountApprovedEmailTemplate, buildSocialAccountDeclinedEmailTemplate
} from "./builders/profile-email.template";
import {
    BuildClientCreatedCampaignTemplateDto,
    BuildInfluencerNewPromoRequestTemplateDto, BuildRequestEditTemplateDto
} from "./dto/templates/campaign-email.dto";
import {
    buildAgencyApprovedEmailTemplate, buildAgencyDeclinedEmailTemplate, buildApprovedEditRequestEmailTemplate,
    buildCampaignApprovedEmailTemplate, buildCampaignDeclinedEmailTemplate,
    buildClientCreatedCampaignTemplate, buildDeclinedEditRequestEmailTemplate,
    buildInfluencerNewPromoRequestTemplate, buildNewBespokeCampaignRequestTemplate, buildRequestEditTemplate
} from "./builders/campaign-email.template";
import {CreateBespokeCampaignDto} from "../../modules/campaigns/dto/bespoke-request.dto";
import {ConfirmNewEmailDto, ForgotPasswordEmailDto} from "./dto/templates/forgot-email.dto";
import {getEmailAttachments} from "./core/email.utils";
import {SocialMediaEnum} from "../../common/types/social-media.types";
import {
    buildConfirmNewEmailTemplate,
    buildNewEmailConfirmedTemplate,
    buildResetPasswordEmailTemplate
} from "./builders/system-email.template";

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
    // Approve new influencer account (after signup)
    influencerApproved: (
        to: string,
        data: { firstName: string }
    ): EmailMessage => {
        const template = buildInfluencerApprovedEmailTemplate(data);

        return {
            to,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: true,
                withInfoQuestion: true,
                withList: true
            }),
        };
    },

    // Decline new influencer account (after signup)
    influencerDeclined: (
        to: string,
        data: { firstName: string }
    ): EmailMessage => {
        const template = buildInfluencerDeclinedEmailTemplate(data);

        return {
            to,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: false,
                withInfoQuestion: false,
            }),
        };
    },

    // Approve new social account
    socialAccountApproved: (
        to: string,
        data: { firstName: string }
    ): EmailMessage => {
        const template = buildSocialAccountApprovedEmailTemplate(data);

        return {
            to,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: true,
                withInfoQuestion: true,
                withList: true
            }),
        };
    },

    // Decline new social account
    socialAccountDeclined: (
        to: string,
        data: { firstName: string }
    ): EmailMessage => {
        const template = buildSocialAccountDeclinedEmailTemplate(data);

        return {
            to,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: false,
                withInfoQuestion: false,
            }),
        };
    },

    // Approve social account's price change request
    priceChangeRequestApproved: (
        to: string,
        data: { firstName: string }
    ): EmailMessage => {
        const template = buildPriceChangeApprovedEmailTemplate(data);

        return {
            to,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: false,
                withInfoQuestion: false,
            }),
        };
    },

    // Decline social account's price change request
    priceChangeRequestDeclined: (
        to: string,
        data: { firstName: string }
    ): EmailMessage => {
        const template = buildPriceChangeDeclinedEmailTemplate(data);

        return {
            to,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: false,
                withInfoQuestion: false,
            }),
        };
    },

    // After approving campaign - influencer receives new promo requests
    newPromoRequest: (
        data: BuildInfluencerNewPromoRequestTemplateDto
    ): EmailMessage => {
        const template = buildInfluencerNewPromoRequestTemplate(data);

        const socialMedias: SocialMediaEnum[] = [
            ...new Set(
                data.accountsAndDetails.map(
                    (item) => item.socialMedia as SocialMediaEnum,
                ),
            ),
        ];

        return {
            to: data.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: false,
                withInfoQuestion: false,
                withSocialIcons: socialMedias
            }),
        };
    },
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

    clientSignup: (data: BuildAccountNegotiationTemplateDto): EmailMessage => ({
        to: ADMIN_EMAIL,
        subject: 'Verify new client',
        html: buildClientSignupRequestTemplate(data),
    })
} as const;

// Emails from us to clients
export const AdminToClientEmails = {
    clientApproved: (
        to: string,
        data: { firstName: string; dashboardUrl: string }
    ): EmailMessage => {
        const template = buildClientApprovedEmailTemplate(data);

        return {
            to,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: true,
                withInfoQuestion: true,
                withList: true
            }),
        };
    },

    clientDeclined: (
        to: string,
        data: { firstName: string }
    ): EmailMessage => {
        const template = buildClientDeclinedEmailTemplate(data);

        return {
            to,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: false,
                withInfoQuestion: false,
                withList: false
            }),
        };
    },

    approvedCampaign: (
        to: string,
        data: { firstName: string }
    ): EmailMessage => {
        const template = buildCampaignApprovedEmailTemplate(data);

        return {
            to,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: true,
                withInfoQuestion: true,
                withList: false
            }),
        };
    },

    declinedCampaign: (
        to: string,
        data: { firstName: string }
    ): EmailMessage => {
        const template = buildCampaignDeclinedEmailTemplate(data);

        return {
            to,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: false,
                withInfoQuestion: false,
                withList: true
            }),
        };
    },

    approvedAgencyCampaign: (
        to: string,
        data: { firstName: string }
    ): EmailMessage => {
        const template = buildAgencyApprovedEmailTemplate(data);

        return {
            to,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: true,
                withInfoQuestion: true,
                withList: true
            }),
        };
    },

    declinedAgencyCampaign: (
        to: string,
        data: { firstName: string }
    ): EmailMessage => {
        const template = buildAgencyDeclinedEmailTemplate(data);

        return {
            to,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: false,
                withInfoQuestion: false,
                withList: true
            }),
        };
    },

    campaignInvoice: (to: string, pdf: Buffer): EmailMessage => ({
        to,
        subject: 'Campaign invoice',
        html: buildClientCampaignInvoiceTemplate(),
        attachments: [
            { filename: 'invoice.pdf', content: pdf, contentType: 'application/pdf' },
        ],
    }),

    resetPassword: (
        to: string,
        data: ForgotPasswordEmailDto
    ): EmailMessage => {
        const template = buildResetPasswordEmailTemplate(data);

        return {
            to,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: false,
                withInfoQuestion: false,
                withList: false
            }),
        };
    },

    confirmNewEmail: (data: ConfirmNewEmailDto): EmailMessage => {
      const template = buildConfirmNewEmailTemplate(data);

        return {
            to: data.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: false,
                withInfoQuestion: true,
                withList: false
            }),
        };
    },

    newEmailConfirmed: (to: string): EmailMessage => {
        const template = buildNewEmailConfirmedTemplate();

        return {
            to,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: false,
                withInfoQuestion: true,
                withList: false
            }),
        };
    },

    editRequestApproved: (to: string, data: { firstName: string }): EmailMessage => {
        const template = buildApprovedEditRequestEmailTemplate(data);

        return {
            to,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: false,
                withInfoQuestion: false,
                withList: true
            }),
        };
    },

    editRequestDeclined: (to: string, data: { firstName: string }): EmailMessage => {
        const template = buildDeclinedEditRequestEmailTemplate(data);

        return {
            to,
            subject: template.subject,
            html: template.html,
            text: template.text,
            attachments: getEmailAttachments({
                withFooterBlock: true,
                withHeroCheck: false,
                withInfoQuestion: false,
                withList: true
            }),
        };
    },
} as const;