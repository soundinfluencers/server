import { emailTheme } from '../core/email-theme';
import { escapeHtml } from '../core/email.utils';
import { inlineStyle } from '../core/email-style';
import {InlineStyleObject} from "./list";

type RenderButtonParams = {
    label: string;
    href: string;
    wrapperStyle?: InlineStyleObject;
    containerStyle?: InlineStyleObject;
    linkStyle?: InlineStyleObject;
};

export function renderButton(params: RenderButtonParams): string {
    const wrapperDefault: InlineStyleObject = {
        margin: '20px auto 24px auto',
    };

    const containerDefault: InlineStyleObject = {
        background: emailTheme.colors.primary,
        borderRadius: 999,
        minWidth: 250,
        minHeight: 50,
    };

    const linkDefault: InlineStyleObject = {
        display: 'inline-block',
        fontFamily: emailTheme.typography.fontFamily,
        fontSize: 16,
        lineHeight: '16px',
        fontWeight: 400,
        color: '#FFFFFF',
        textDecoration: 'none',
        padding: '14px 28px',
    };

    return `
        <table
            role="presentation"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="${inlineStyle({
        ...wrapperDefault,
        ...params.wrapperStyle,
    })}"
        >
            <tr>
                <td
                    align="center"
                    bgcolor="${emailTheme.colors.primary}"
                    style="${inlineStyle({
        ...containerDefault,
        ...params.containerStyle,
    })}"
                >
                    <a
                        href="${params.href}"
                        target="_blank"
                        style="${inlineStyle({
        ...linkDefault,
        ...params.linkStyle,
    })}"
                    >
                        ${escapeHtml(params.label)}
                    </a>
                </td>
            </tr>
        </table>
    `;
}