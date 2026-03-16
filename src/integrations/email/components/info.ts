import { emailTheme } from '../core/email-theme';
import { escapeHtml } from '../core/email.utils';
import { inlineStyle } from '../core/email-style';
import { renderButton } from './button';
import {InlineStyleObject} from "./list";

type RenderInfoCardParams = {
    title: string;
    description: string;
    buttonText: string;
    buttonUrl: string;
    questionSrc?: string;

    wrapperStyle?: InlineStyleObject;
    titleStyle?: InlineStyleObject;
    descriptionStyle?: InlineStyleObject;
    buttonWrapperStyle?: InlineStyleObject;
};

export function renderInfoCard(params: RenderInfoCardParams): string {
    const {
        title,
        description,
        buttonText,
        buttonUrl,
        questionSrc = 'cid:question',
        wrapperStyle,
        titleStyle,
        descriptionStyle,
        buttonWrapperStyle,
    } = params;

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
        marginTop: 42,
        ...wrapperStyle,
    })}"
        >
            <tr>
                <td style="${inlineStyle({ padding: '0' })}">
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
                                valign="middle"
                                width="250"
                                style="${inlineStyle({
        width: 250,
        padding: '8px 32px 8px 100px',
    })}"
                            >
                                <img
                                    src="${questionSrc}"
                                    alt="Help"
                                    width="250"
                                    height="250"
                                    style="${inlineStyle({
        display: 'block',
        width: 250,
        height: 250,
        border: 0,
        cursor: 'none',
    })}"
                                />
                            </td>

                            <td
                                valign="middle"
                                style="${inlineStyle({
        padding: '24px 100px 24px 12px',
        fontFamily: emailTheme.typography.fontFamily,
    })}"
                            >
                                <div style="${inlineStyle({
        fontFamily: emailTheme.typography.fontFamily,
        fontSize: 22,
        lineHeight: '22px',
        fontWeight: 400,
        color: '#2E3440',
        marginBottom: 8,
        ...titleStyle,
    })}">
                                    ${escapeHtml(title)}
                                </div>

                                <div style="${inlineStyle({
        fontFamily: emailTheme.typography.fontFamily,
        fontSize: 18,
        lineHeight: '20px',
        fontWeight: 400,
        color: '#6F7785',
        ...descriptionStyle,
    })}">
                                    ${escapeHtml(description)}
                                </div>

                                ${renderButton({
        label: buttonText,
        href: buttonUrl,
        wrapperStyle: {
            margin: '20px 0 0 0',
            ...buttonWrapperStyle,
        },
    })}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    `;
}