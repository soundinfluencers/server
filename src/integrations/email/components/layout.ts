import {emailTheme} from '../core/email-theme';
import {escapeHtml, getEmailFontFaceCss} from '../core/email.utils';
import {inlineStyle} from '../core/email-style';
import {renderFooter} from './footer';

type RenderEmailLayoutParams = {
    preheader?: string;
    content: string;
};

export function renderEmailLayout(params: RenderEmailLayoutParams): string {
    const {preheader, content} = params;

    return `
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta http-equiv="x-ua-compatible" content="ie=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Email</title>
    <style>
        ${getEmailFontFaceCss()}
    </style>
</head>
<body style="${inlineStyle({
        margin: 0,
        padding: 0,
        background: emailTheme.colors.bodyBg,
        fontFamily: emailTheme.typography.fontFamily,
    })}">
    <div style="${inlineStyle({
        display: 'none',
        maxHeight: 0,
        overflow: 'hidden',
        opacity: 0,
    })}">
        ${escapeHtml(preheader ?? '')}
    </div>

    <table
        role="presentation"
        cellpadding="0"
        cellspacing="0"
        border="0"
        width="100%"
        style="${inlineStyle({
        width: '100%',
        borderCollapse: 'collapse',
        background: emailTheme.colors.bodyBg,
    })}"
    >
        <tr>
            <td
                align="center"
                style="${inlineStyle({
        padding: `${emailTheme.layout.outerPadding}px 12px`,
    })}"
            >
                <table
                    role="presentation"
                    cellpadding="0"
                    cellspacing="0"
                    border="0"
                    width="${emailTheme.layout.maxWidth}"
                    style="${inlineStyle({
        width: '100%',
        maxWidth: emailTheme.layout.maxWidth,
        borderCollapse: 'separate',
        background: emailTheme.colors.containerBg,
        overflow: 'hidden',
        padding: `30px 30px 0`,
    })}"
                >
                    <tr>
                        <td>
                            ${content}
                        </td>
                    </tr>
                </table>

                ${renderFooter(
        {
            logo: 'cid:footer_logo',
            linkedinIcon: 'cid:linkedin-icon',
            instagramIcon: 'cid:instagram_footer-icon',
            phoneIcon: 'cid:phone-icon',
            telegramIcon: 'cid:telegram-icon',
            whatsappIcon: 'cid:whatsapp-icon',
        },
        {
            logo: 'FOOTER_LOGO-link',
            linkedin: 'FOOTER_LINKEDIN-link',
            instagram: 'FOOTER_INSTAGRAM-link',
            founderEmail: 'mailto:eric@soundinfluencers.com',
            teamEmail: 'mailto:admin@soundinfluencers.com',
            phone: 'tel:+447537129190',
            telegram: 'FOOTER_TELEGRAM-link',
            whatsapp: 'FOOTER_WHATSAPP-link',
        }
    )}
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}