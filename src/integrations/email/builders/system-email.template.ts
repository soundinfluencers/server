import {ConfirmNewEmailDto, ForgotPasswordEmailDto} from "../dto/templates/forgot-email.dto";
import {buildUserEmailTemplate} from "../templates/user-email.template";
import {emailTheme} from "../core/email-theme";

// Reset password
export function buildResetPasswordEmailTemplate(data: ForgotPasswordEmailDto) {
    return buildUserEmailTemplate({
        subject: 'Reset Password',
        preheader: 'Reset Password',
        headerImg: false,
        title: 'RESET YOUR PASSWORD',
        blocks: [
            {
                type: 'greeting',
                text: `Hi ${data.firstName},`,
            },
            {
                type: 'paragraph',
                text: 'We received a request to reset the password for your SoundInfluencers account.',
            },
            {
                type: 'paragraph',
                text: 'To create a new password, please click the button below:',
            },
            {
                type: 'button',
                cta: {
                    label: 'CREATE NEW PASSWORD',
                    href: data.link
                },
                wrapperStyle: {
                    margin: '48px auto 48px auto',
                }
            },
            {
                type: 'paragraph',
                text: 'This link will securely open a page where you can enter and confirm your new password.'
            },
            {
                type: 'paragraph',
                text: 'For security reasons, this link will expire in 60 minutes.'
            },
            {
                type: 'paragraph',
                text: "If you did not request a password reset, you can safely ignore this email. Your account will remain unchanged."
            },
            {
                type: 'paragraph',
                text: "Need help?",
                style: {
                    fontSize: 26,
                    lineHeight: '26px',
                    margin: '32px 0 16px 0',
                }
            },
            {
                type: 'paragraph',
                text: "If you're experiencing issues accessing your account, our support team is here to assist you."
            },
            {
                type: 'button',
                cta: {
                    label: 'Contact Support',
                    href: process.env.EMAIL_SUPPORT_URL!
                },
                wrapperStyle: {
                    margin: '48px auto 20px auto',
                },
                containerStyle: {
                    background: emailTheme.colors.secondBtn,
                },
                linkStyle: {
                    color: emailTheme.colors.text
                }
            },
        ],
        footerNote: 'WE APPRECIATE YOUR INTEREST IN WORKING WITH SOUNDINFLUENCERS',
    });
}

// Confirm new email
export function buildConfirmNewEmailTemplate(data: ConfirmNewEmailDto) {
    return buildUserEmailTemplate({
        subject: 'Confirm New Email',
        preheader: 'Confirm New Email',
        headerImg: false,
        title: 'Confirm your new email address',
        blocks: [
            {
                type: 'greeting',
                text: `Hi ${data.firstName},`,
            },
            {
                type: 'paragraph',
                text: 'You recently requested to change the email address associated with your SoundInfluencers account to:',
            },
            {
                type: 'paragraph',
                text: data.email,
                style: {
                    fontWeight: 500
                }
            },
            {
                type: 'paragraph',
                text: 'Please confirm this change by clicking the button below.'
            },
            {
                type: 'button',
                cta: {
                    label: 'VERIFY NEW EMAIL',
                    href: data.link
                },
                wrapperStyle: {
                    margin: '48px auto 48px auto',
                }
            },
            {
                type: 'paragraph',
                text: 'If this wasn’t you, please secure your account immediately or contact support.'
            },
            {
                type: 'infoCard',
                card: {
                    title: 'Learn How It Works',
                    description:
                        'Our Help Center walks you through campaigns, payments, and platform features — with practical tips to help you maximize every collaboration.',
                    button: {
                        label: 'Help Center',
                        href: process.env.EMAIL_HELP_CENTER_URL,
                    },
                },
            },
        ],
        footerNote: 'We’re always here to help',
    });
}

// New email confirmed (after user confirmed new email)
export function buildNewEmailConfirmedTemplate() {
    return buildUserEmailTemplate({
        subject: 'Updated Email',
        preheader: 'Updated Email',
        headerImg: false,
        title: 'Your email has been updated',
        blocks: [
            {
                type: 'paragraph',
                text: 'Your account email has been successfully updated.',
            },
            {
                type: 'paragraph',
                text: 'If you did not make this change, please contact our support team immediately.',
            },
            {
                type: 'button',
                cta: {
                    label: 'Contact Support',
                    href: process.env.EMAIL_SUPPORT_URL!
                },
                wrapperStyle: {
                    margin: '48px auto 48px auto',
                }
            },
            {
                type: 'infoCard',
                card: {
                    title: 'Learn How It Works',
                    description:
                        'Our Help Center walks you through campaigns, payments, and platform features — with practical tips to help you maximize every collaboration.',
                    button: {
                        label: 'Help Center',
                        href: process.env.EMAIL_HELP_CENTER_URL,
                    },
                },
            },
        ],
        footerNote: 'We’re always here to help',
    });
}
