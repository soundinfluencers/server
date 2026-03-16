import { emailTheme } from '../core/email-theme';
import { escapeHtml } from '../core/email.utils';
import { inlineStyle } from '../core/email-style';
import {InlineStyleObject} from "./list";

type RenderHeroParams = {
    title: string;
    needHeroImg: boolean;
    subtitle?: string;
    logoSrc?: string;
    badgeSrc?: string;

    wrapperStyle?: InlineStyleObject;
    titleStyle?: InlineStyleObject;
    subtitleStyle?: InlineStyleObject;
};

export function renderHero(params: RenderHeroParams): string {
    const {
        title,
        subtitle,
        needHeroImg,
        logoSrc = 'cid:header_logo',
        badgeSrc = 'cid:hero_check',
        wrapperStyle,
        titleStyle,
        subtitleStyle,
    } = params;

    const subtitleBlock = subtitle
        ? `
        <div style="${inlineStyle({
            marginTop: 10,
            fontFamily: emailTheme.typography.fontFamily,
            fontSize: 20,
            lineHeight: '20px',
            color: '#6F7785',
            fontWeight: 400,
            ...subtitleStyle,
        })}">
            ${escapeHtml(subtitle)}
        </div>
        `
        : '';

    const heroImageBlock = needHeroImg
        ? `
        <img
            src="${badgeSrc}"
            alt="Approved"
            width="250"
            height="250"
            style="${inlineStyle({
            display: 'block',
            width: 250,
            maxWidth: '100%',
            height: 'auto',
            border: 0,
            margin: '20px auto 0 auto',
            background: 'transparent',
            cursor: 'none',
        })}"
        />
        `
        : '';

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
        marginBottom: 28,
        ...wrapperStyle,
    })}"
        >
            <tr>
                <td
                    align="center"
                    style="${inlineStyle({
        padding: '36px 28px 30px 28px',
    })}"
                >
                    <table
                        role="presentation"
                        cellpadding="0"
                        cellspacing="0"
                        border="0"
                        align="center"
                        style="${inlineStyle({
        borderCollapse: 'collapse',
        margin: '0 auto 46px auto',
    })}"
                    >
                        <tr>
                            <td
                                valign="middle"
                                style="${inlineStyle({
        paddingRight: 12,
    })}"
                            >
                                <img
                                    src="${logoSrc}"
                                    alt=""
                                    width="30"
                                    height="31"
                                    style="${inlineStyle({
        display: 'block',
        width: 35,
        height: 35,
        border: 0,
        marginTop: 4,
        cursor: 'none',
    })}"
                                />
                            </td>
                            <td
                                valign="middle"
                                style="${inlineStyle({
        fontFamily: emailTheme.typography.fontFamily,
        fontWeight: 700,
        fontSize: 24,
        lineHeight: '24px',
        letterSpacing: '0',
        color: emailTheme.colors.primary,
        whiteSpace: 'nowrap',
    })}"
                            >
                                SoundInfluencers
                            </td>
                        </tr>
                    </table>

                    <div style="${inlineStyle({
        fontFamily: emailTheme.typography.fontFamily,
        fontSize: needHeroImg ? 52 : 36,
        lineHeight: needHeroImg ? '52px' : '36px',
        fontWeight: needHeroImg ? 700 : 600,
        color: emailTheme.colors.primary,
        textTransform: 'uppercase',
        letterSpacing: '-1px',
        ...titleStyle,
    })}">
                        ${escapeHtml(title)}
                    </div>

                    ${subtitleBlock}
                    ${heroImageBlock}
                </td>
            </tr>
        </table>
    `;
}