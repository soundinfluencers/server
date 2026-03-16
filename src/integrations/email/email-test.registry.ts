import { EmailMessage } from './types/email.types';
import { SocialMediaEnum } from '../../common/types/social-media.types';
import {
    AdminToClientEmails,
    AdminToInfluencerEmails,
} from './email.templates';

type TestEmailFactory = () => EmailMessage;

export const TestEmailRegistry = {
    'admin-to-influencer.influencerApproved': () =>
        AdminToInfluencerEmails.influencerApproved(process.env.EMAIL_USER!, {
            firstName: 'John',
        }),

    'admin-to-influencer.influencerDeclined': () =>
        AdminToInfluencerEmails.influencerDeclined(process.env.EMAIL_USER!, {
            firstName: 'John',
        }),

    'admin-to-influencer.socialAccountApproved': () =>
        AdminToInfluencerEmails.socialAccountApproved(process.env.EMAIL_USER!, {
            firstName: 'John',
        }),

    'admin-to-influencer.socialAccountDeclined': () =>
        AdminToInfluencerEmails.socialAccountDeclined(process.env.EMAIL_USER!, {
            firstName: 'John',
        }),

    'admin-to-influencer.priceChangeRequestApproved': () =>
        AdminToInfluencerEmails.priceChangeRequestApproved(process.env.EMAIL_USER!, {
            firstName: 'John',
        }),

    'admin-to-influencer.priceChangeRequestDeclined': () =>
        AdminToInfluencerEmails.priceChangeRequestDeclined(process.env.EMAIL_USER!, {
            firstName: 'John',
        }),

    'admin-to-influencer.newPromoRequest': () =>
        AdminToInfluencerEmails.newPromoRequest({
            email: process.env.EMAIL_USER!,
            firstName: 'John',
            accountsAndDetails: [
                {
                    pageName: 'john_music',
                    dateRequest: '2026-03-15',
                    reward: '$300',
                    socialMedia: SocialMediaEnum.instagram,
                    mainLink: 'https://instagram.com/john_music',
                    description: 'Story + reel promo',
                },
                {
                    pageName: 'john_tok',
                    dateRequest: '2026-03-16',
                    reward: '$500',
                    socialMedia: SocialMediaEnum.tiktok,
                    mainLink: 'https://tiktok.com/@john_tok',
                    description: 'TikTok integration',
                },
            ],
        }),

    'admin-to-client.clientApproved': () =>
        AdminToClientEmails.clientApproved(process.env.EMAIL_USER!, {
            firstName: 'Anna',
            dashboardUrl: 'https://app.soundinfluencers.com/dashboard',
        }),

    'admin-to-client.clientDeclined': () =>
        AdminToClientEmails.clientDeclined(process.env.EMAIL_USER!, {
            firstName: 'Anna',
        }),

    'admin-to-client.approvedCampaign': () =>
        AdminToClientEmails.approvedCampaign(process.env.EMAIL_USER!, {
            firstName: 'Anna',
        }),

    'admin-to-client.declinedCampaign': () =>
        AdminToClientEmails.declinedCampaign(process.env.EMAIL_USER!, {
            firstName: 'Anna',
        }),

    'admin-to-client.approvedAgencyCampaign': () =>
        AdminToClientEmails.approvedAgencyCampaign(process.env.EMAIL_USER!, {
            firstName: 'Anna',
        }),

    'admin-to-client.declinedAgencyCampaign': () =>
        AdminToClientEmails.declinedAgencyCampaign(process.env.EMAIL_USER!, {
            firstName: 'Anna',
        }),

    'admin-to-client.resetPassword': () =>
        AdminToClientEmails.resetPassword(process.env.EMAIL_USER!, {
            firstName: 'Anna',
            link: process.env.EMAIL_LOGIN_URL
        }),

    'admin-to-client.confirmNewEmail': () =>
        AdminToClientEmails.confirmNewEmail({
            firstName: 'Anna',
            email: process.env.EMAIL_USER!,
            link: process.env.EMAIL_LOGIN_URL
        }),

    'admin-to-client.newEmailConfirmed': () =>
        AdminToClientEmails.newEmailConfirmed(process.env.EMAIL_USER!),

    'admin-to-client.editRequestApproved': () =>
        AdminToClientEmails.editRequestApproved(process.env.EMAIL_USER!, {
            firstName: 'Anna',
        }),

    'admin-to-client.editRequestDeclined': () =>
        AdminToClientEmails.editRequestDeclined(process.env.EMAIL_USER!, {
            firstName: 'Anna',
        }),
} satisfies Record<string, TestEmailFactory>;

export type TestEmailKey = keyof typeof TestEmailRegistry;

export const TEST_EMAIL_KEYS = Object.keys(TestEmailRegistry) as TestEmailKey[];