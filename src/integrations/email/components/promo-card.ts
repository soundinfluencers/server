import {inlineStyle} from "../core/email-style";
import {emailTheme} from "../core/email-theme";
import {escapeHtml, getSocialMediaIconForEmail} from "../core/email.utils";
import {renderButton} from "./button";
import {SocialMediaEnum} from "../../../common/types/social-media.types";

// type for email promo cards
export type PromoRequestCardInput = {
    socialMedia: string;
    rawSocialMedia: SocialMediaEnum;
    pageName: string;
    mainLink: string;
    description: string;
    taggedUser: string;
    additionalBrief?: string;
    reward: string;
    iconSrc?: string;
};

function renderPromoField(label: string, value: string, isLink = false): string {
    const safeValue = escapeHtml(value);

    return `
        <tr>
            <td
                valign="top"
                width="86"
                style="${inlineStyle({
        width: 86,
        padding: '0 12px 16px 0',
        fontFamily: emailTheme.typography.fontFamily,
        fontSize: 18,
        lineHeight: '20px',
        color: emailTheme.colors.text,
        fontWeight: 400,
        whiteSpace: 'nowrap',
    })}"
            >
                ${escapeHtml(label)}
            </td>
            <td
                valign="top"
                style="${inlineStyle({
        padding: '0 0 16px 0',
        fontFamily: emailTheme.typography.fontFamily,
        fontSize: 18,
        lineHeight: '20px',
        color: emailTheme.colors.text,
        fontWeight: 500,
    })}"
            >
                ${
        isLink
            ? `<a href="${value}" target="_blank" style="${inlineStyle({
                color: emailTheme.colors.text,
                textDecoration: 'underline',
            })}">${safeValue}</a>`
            : safeValue
    }
            </td>
        </tr>
    `;
}

export function renderPromoRequestCard(input: PromoRequestCardInput): string {
    const {
        socialMedia,
        rawSocialMedia,
        pageName,
        mainLink,
        description,
        taggedUser,
        additionalBrief,
        reward,
    } = input;

    return `
        <table
            role="presentation"
            cellpadding="0"
            cellspacing="0"
            border="0"
            width="100%"
            style="${inlineStyle({
        width: '100%',
        borderCollapse: 'separate',
        borderSpacing: 0,
        background: '#F6F9FC',
        border: '1px solid #D8E4F2',
        borderRadius: 16,
    })}"
        >
            <tr>
                <td style="${inlineStyle({ padding: '24px' })}">
                    <table
                        role="presentation"
                        cellpadding="0"
                        cellspacing="0"
                        border="0"
                        width="100%"
                        style="${inlineStyle({
        width: '100%',
        borderCollapse: 'collapse',
    })}"
                    >
                        <tr>
                            <td style="${inlineStyle({
        padding: '0 0 12px 0',
        borderBottom: '1px solid #D8E4F2',
    })}">
                                <table
                                    role="presentation"
                                    cellpadding="0"
                                    cellspacing="0"
                                    border="0"
                                    style="${inlineStyle({
        borderCollapse: 'collapse',
    })}"
                                >
                                    <tr>
                                    <td style="${inlineStyle({ paddingRight: 8 })}">
                                            <img
                                                src="cid:${getSocialMediaIconForEmail(rawSocialMedia)?.cid}"
                                                alt=""
                                                width="24"
                                                height="24"
                                                style="${inlineStyle({
        display: 'block',
        width: 24,
        height: 24,
        border: 0,
        color: 'black'
    })}"
                                            />
                                        </td>
                                        
                                        <td style="${inlineStyle({
        fontFamily: emailTheme.typography.fontFamily,
        fontSize: 20,
        lineHeight: '24px',
        color: emailTheme.colors.text,
        fontWeight: 400,
    })}">
                                            ${escapeHtml(socialMedia)} (1 post + 1 Story)
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <tr>
                            <td style="${inlineStyle({ paddingTop: '24px' })}">
                                <table
                                    role="presentation"
                                    cellpadding="0"
                                    cellspacing="0"
                                    border="0"
                                    width="100%"
                                    style="${inlineStyle({
        width: '100%',
        borderCollapse: 'collapse',
    })}"
                                >
                                    ${renderPromoField('Page:', pageName)}
                                    ${renderPromoField('Content:', mainLink, true)}
                                    ${renderPromoField('Description:', description)}
                                    ${renderPromoField('Story tag:', taggedUser)}
                                    ${additionalBrief ? renderPromoField('Additional Brief:', additionalBrief) : ''}
                                    ${renderPromoField('Reward:', reward)}
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    `;
}

type RenderPromoCtaBannerParams = {
    text: string;
    buttonLabel: string;
    buttonHref: string;
};

export function renderPromoCtaBanner(params: RenderPromoCtaBannerParams): string {
    const { text, buttonLabel, buttonHref } = params;

    return `
        <table
            role="presentation"
            cellpadding="0"
            cellspacing="0"
            border="0"
            width="100%"
            style="${inlineStyle({
        width: '100%',
        borderCollapse: 'collapse',
        background: emailTheme.colors.heroBg,
        borderRadius: 18,
        marginTop: 28,
        marginBottom: 0,
    })}"
        >
            <tr>
                <td
                    align="center"
                    style="${inlineStyle({
        padding: '40px 24px 40px',
    })}"
                >
                    <div
                        style="${inlineStyle({
        fontFamily: emailTheme.typography.fontFamily,
        fontSize: 20,
        lineHeight: '20px',
        fontWeight: 400,
        color: emailTheme.colors.text,
        textAlign: 'center',
        margin: '0 0 24px 0',
    })}"
                    >
                        ${escapeHtml(text)}
                    </div>

                    ${renderButton({
        label: buttonLabel,
        href: buttonHref,
        wrapperStyle: {
            margin: '0 auto',
        },
    })}
                </td>
            </tr>
        </table>
    `;
}