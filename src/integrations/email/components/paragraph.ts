import { emailTheme } from '../core/email-theme';
import { escapeHtml } from '../core/email.utils';
import { inlineStyle } from '../core/email-style';
import {InlineStyleObject} from "./list";

type RenderParagraphParams = {
    text: string;
    style?: InlineStyleObject;
};

export function renderParagraph(params: RenderParagraphParams): string {
    const defaultStyle: InlineStyleObject = {
        margin: '0 0 16px 0',
        fontFamily: emailTheme.typography.fontFamily,
        fontWeight: 400,
        fontSize: 20,
        lineHeight: '24px',
        letterSpacing: '0',
        color: emailTheme.colors.text,
    };

    return `
        <div style="${inlineStyle({
        ...defaultStyle,
        ...params.style,
    })}">
            ${escapeHtml(params.text)}
        </div>
    `;
}