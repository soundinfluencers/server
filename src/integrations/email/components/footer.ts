import { emailTheme } from '../core/email-theme';
import { escapeHtml } from '../core/email.utils';
import { inlineStyle } from '../core/email-style';

type FooterAssets = {
    logo: string;
    instagramIcon: string;
    linkedinIcon: string;
    phoneIcon: string;
    telegramIcon: string;
    whatsappIcon: string;
};

type FooterLinks = {
    logo: string;
    instagram: string;
    linkedin: string;
    phone: string;
    telegram: string;
    whatsapp: string;
    founderEmail: string;
    teamEmail: string;
};

function renderIcon(src: string, alt: string, size = 20): string {
    return `
        <img
            src="${src}"
            alt="${escapeHtml(alt)}"
            width="${size}"
            height="${size}"
            style="${inlineStyle({
        display: 'block',
        width: `${size}px`,
        height: `${size}px`,
        border: 0,
        outline: 'none',
        textDecoration: 'none',
    })}"
        />
    `;
}

function renderIconLink(src: string, alt: string, href: string, size = 20): string {
    return `
        <a
            href="${href}"
            target="_blank"
            style="${inlineStyle({
        display: 'inline-block',
        textDecoration: 'none',
    })}"
        >
            ${renderIcon(src, alt, size)}
        </a>
    `;
}

function renderContactItem(iconSrc: string, alt: string, href: string, label: string): string {
    return `
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
                <td style="${inlineStyle({
        paddingRight: '8px',
        verticalAlign: 'middle',
    })}">
                    ${renderIconLink(iconSrc, alt, href, 20)}
                </td>
                <td style="${inlineStyle({
        verticalAlign: 'middle',
    })}">
<a
    href="${href}"
    target="_blank"
    style="${inlineStyle({
        display: 'inline-block',
        position: 'relative',
        top: '-2px',
        color: emailTheme.colors.white,
        textDecoration: 'none',
        fontFamily: emailTheme.typography.fontFamily,
        fontSize: '14px',
        lineHeight: '14px',
        fontWeight: 400,
        whiteSpace: 'nowrap',
    })}"
>
    ${escapeHtml(label)}
</a>
                </td>
            </tr>
        </table>
    `;
}

function renderFooterText(label: string, href: string, text: string): string {
    return `
        <span style="${inlineStyle({
        color: emailTheme.colors.white,
        fontFamily: emailTheme.typography.fontFamily,
        fontSize: '14px',
        lineHeight: '14px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        
    })}">
            ${escapeHtml(label)}
        </span>
        <a
            href="${href}"
            target="_blank"
            style="${inlineStyle({
        color: emailTheme.colors.white,
        textDecoration: 'none',
        fontFamily: emailTheme.typography.fontFamily,
        fontSize: '14px',
        lineHeight: '14px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
    })}"
        >
            ${escapeHtml(text)}
        </a>
    `;
}

function renderDotOnLine(): string {
    return `
        <table
            role="presentation"
            cellpadding="0"
            cellspacing="0"
            border="0"
            width="22"
            style="${inlineStyle({
        width: '22px',
        borderCollapse: 'collapse',
    })}"
        >
            <tr>
                <td
                    align="center"
                    style="${inlineStyle({
        fontSize: 0,
        lineHeight: 0,
    })}"
                >
                    <span style="${inlineStyle({
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#FFFFFF',
        position: 'relative',
        top: '-4px',
    })}"></span>
                </td>
            </tr>
        </table>
    `;
}

function renderDividerContent(
    footerAssets: FooterAssets,
    footerLinks: FooterLinks,
): string {
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
    })}"
        >
            <tr>
                <td
                    valign="top"
                    width="28%"
                    style="${inlineStyle({
        width: '28%',
        verticalAlign: 'top',
        borderTop: '1px solid #FFFFFF',
        paddingTop: '18px',
        paddingRight: '16px',
    })}"
                >
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
                            <td style="${inlineStyle({ paddingRight: '12px' })}">
                                ${renderIconLink(
        footerAssets.instagramIcon,
        'Instagram',
        footerLinks.instagram,
        22,
    )}
                            </td>
                            <td>
                                ${renderIconLink(
        footerAssets.linkedinIcon,
        'LinkedIn',
        footerLinks.linkedin,
        22,
    )}
                            </td>
                        </tr>
                    </table>
                </td>

<td
    width="22"
    valign="top"
    align="center"
    style="${inlineStyle({
        width: '22px',
        verticalAlign: 'top',
        paddingTop: '0',
        borderTop: '1px solid #FFFFFF',
    })}"
>
    ${renderDotOnLine()}
</td>

                <td
                    valign="top"
                    width="33%"
                    style="${inlineStyle({
        width: '33%',
        verticalAlign: 'top',
        borderTop: '1px solid #FFFFFF',
        paddingTop: '18px',
        paddingRight: '16px',
    })}"
                >
                    ${renderFooterText(
        'Founder Eric Simi: ',
        footerLinks.founderEmail,
        'eric@soundinfluencers.com',
    )}
                </td>

<td
    width="22"
    valign="top"
    align="center"
    style="${inlineStyle({
        width: '22px',
        verticalAlign: 'top',
        paddingTop: '0',
        borderTop: '1px solid #FFFFFF',
    })}"
>
    ${renderDotOnLine()}
</td>

                <td
                    valign="top"
                    width="39%"
                    style="${inlineStyle({
        width: '39%',
        verticalAlign: 'top',
        borderTop: '1px solid #FFFFFF',
        paddingTop: '18px',
    })}"
                >
                    ${renderFooterText(
        'Team: ',
        footerLinks.teamEmail,
        'admin@soundinfluencers.com',
    )}
                </td>
            </tr>
        </table>
    `;
}

export function renderFooter(
    assets?: FooterAssets,
    links?: FooterLinks,
): string {
    const footerAssets: FooterAssets = assets ?? {
        logo: 'FOOTER_LOGO_SRC',
        instagramIcon: 'FOOTER_INSTAGRAM_ICON_SRC',
        linkedinIcon: 'FOOTER_LINKEDIN_ICON_SRC',
        phoneIcon: 'FOOTER_PHONE_ICON_SRC',
        telegramIcon: 'FOOTER_TELEGRAM_ICON_SRC',
        whatsappIcon: 'FOOTER_WHATSAPP_ICON_SRC',
    };

    const footerLinks: FooterLinks = links ?? {
        logo: 'FOOTER_LOGO_LINK',
        instagram: 'FOOTER_INSTAGRAM_LINK',
        linkedin: 'FOOTER_LINKEDIN_LINK',
        phone: 'tel:+447537129190',
        telegram: 'FOOTER_TELEGRAM_LINK',
        whatsapp: 'FOOTER_WHATSAPP_LINK',
        founderEmail: 'mailto:eric@soundinfluencers.com',
        teamEmail: 'mailto:admin@soundinfluencers.com',
    };

    return `
        <table
            role="presentation"
            cellpadding="0"
            cellspacing="0"
            border="0"
            width="${emailTheme.layout.maxWidth}"
            style="${inlineStyle({
        width: '100%',
        maxWidth: emailTheme.layout.maxWidth,
        borderCollapse: 'collapse',
    })}"
        >
            <tr>
                <td style="${inlineStyle({
        background: emailTheme.colors.primary,
        padding: '40px 100px 30px',
        fontFamily: emailTheme.typography.fontFamily,
    })}">
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
                            <td style="${inlineStyle({ paddingBottom: '36px' })}">
                                <a
                                    href="${footerLinks.logo}"
                                    target="_blank"
                                    style="${inlineStyle({
        display: 'inline-block',
        textDecoration: 'none',
    })}"
                                >
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
                                            <td style="${inlineStyle({
        verticalAlign: 'middle',
        paddingRight: '12px',
    })}">
                                                <img
                                                    src="${footerAssets.logo}"
                                                    alt="SoundInfluencers"
                                                    width="30"
                                                    height="36"
                                                    style="${inlineStyle({
        display: 'block',
        width: '28px',
        height: '28px',
        border: 0,
        outline: 'none',
        textDecoration: 'none',
    })}"
                                                />
                                            </td>

                                            <td style="${inlineStyle({
        verticalAlign: 'middle',
        color: emailTheme.colors.white,
        fontFamily: emailTheme.typography.fontFamily,
        fontSize: '30px',
        lineHeight: '30px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
    })}">
                                                SoundInfluencers
                                            </td>
                                        </tr>
                                    </table>
                                </a>
                            </td>
                        </tr>

                        <tr>
                            <td style="${inlineStyle({
        color: emailTheme.colors.white,
        fontFamily: emailTheme.typography.fontFamily,
        fontSize: '18px',
        lineHeight: '20px',
        fontWeight: 500,
        paddingBottom: '14px',
    })}">
                                Contact Us
                            </td>
                        </tr>

                        <tr>
                            <td style="${inlineStyle({ paddingBottom: '22px' })}">
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
                                        <td style="${inlineStyle({ paddingRight: '26px' })}">
                                            ${renderContactItem(
        footerAssets.whatsappIcon,
        'WhatsApp',
        footerLinks.whatsapp,
        'WhatsApp',
    )}
                                        </td>

                                        <td style="${inlineStyle({ paddingRight: '26px' })}">
                                            ${renderContactItem(
        footerAssets.phoneIcon,
        'Phone',
        footerLinks.phone,
        '+447537129190',
    )}
                                        </td>

                                        <td>
                                            ${renderContactItem(
        footerAssets.telegramIcon,
        'Telegram',
        footerLinks.telegram,
        'Telegram',
    )}
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <tr>
                            <td style="${inlineStyle({
        paddingBottom: '24px',
    })}">
                                ${renderDividerContent(footerAssets, footerLinks)}
                            </td>
                        </tr>

                        <tr>
                            <td
                                align="right"
                                style="${inlineStyle({
        color: emailTheme.colors.white,
        fontFamily: emailTheme.typography.fontFamily,
        fontSize: '12px',
        lineHeight: '12px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
    })}"
                            >
                                © 2026 SoundInfluencers
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    `;
}