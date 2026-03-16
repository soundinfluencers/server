import {
    EmailTemplateResult, UserEmailBlock,
    UserEmailTemplateInput,
} from '../core/email-template.types';
import {escapeHtml, joinHtml} from '../core/email.utils';
import { renderButton } from '../components/button';
import { renderHero } from '../components/hero';
import { renderInfoCard } from '../components/info';
import { renderEmailLayout } from '../components/layout';
import { renderParagraph } from '../components/paragraph';
import {renderList} from "../components/list";
import {emailTheme} from "../core/email-theme";
import {inlineStyle} from "../core/email-style";

function renderBlock(block: UserEmailBlock): { html: string; text?: string } {
    const wrapWithPadding = (html: string) =>
        `<div style="${inlineStyle({ padding: '0 60px' })}">${html}</div>`;

    switch (block.type) {
        case 'greeting': {
            const html = renderParagraph({
                text: block.text,
                style: block.style,
            });

            return {
                html: wrapWithPadding(html),
                text: block.text,
            };
        }

        case 'paragraph': {
            const html = renderParagraph({
                text: block.text,
                style: block.style,
            });

            return {
                html: wrapWithPadding(html),
                text: block.text,
            };
        }

        case 'list': {
            const html = renderList({
                title: block.title,
                items: block.items,
                titleStyle: block.titleStyle,
                itemStyle: block.itemStyle,
                wrapperStyle: block.wrapperStyle,
                bulletImg: block.bulletImg,
                disableBullets: block.disableBullets,
            });

            const textItems = block.items.map((item) => {
                if (typeof item === 'string') return item;
                if (item.type === 'text') return item.text;
                return item.text ?? '';
            }).filter(Boolean);

            return {
                html: wrapWithPadding(html),
                text: textItems.length
                    ? `${block.title ? `${block.title}: ` : ''}${textItems.join('; ')}`
                    : '',
            };
        }

        case 'button': {
            const html = renderButton({
                label: block.cta.label,
                href: block.cta.href,
                wrapperStyle: block.wrapperStyle,
                containerStyle: block.containerStyle,
                linkStyle: block.linkStyle,
            });

            return {
                html: wrapWithPadding(html),
                text: `${block.cta.label}: ${block.cta.href}`,
            };
        }

        case 'infoCard':
            return {
                html: renderInfoCard({
                    title: block.card.title,
                    description: block.card.description,
                    buttonText: block.card.button.label,
                    buttonUrl: block.card.button.href,
                    questionSrc: block.card.questionSrc,
                    wrapperStyle: block.wrapperStyle,
                    titleStyle: block.titleStyle,
                    descriptionStyle: block.descriptionStyle,
                    buttonWrapperStyle: block.buttonWrapperStyle,
                }),
                text: `${block.card.title}\n${block.card.description}\n${block.card.button.label}: ${block.card.button.href}`,
            };

        case 'html': {
            const html = block.style
                ? `<div style="${inlineStyle(block.style)}">${block.html}</div>`
                : block.html;

            return {
                html: html,
                text: block.text,
            };
        }

        default:
            return {
                html: '',
                text: '',
            };
    }
}

export function buildUserEmailTemplate(
    input: UserEmailTemplateInput,
): EmailTemplateResult {
    const needHeroImg = input.headerImg ?? false;

    const heroBlock = renderHero({
        title: input.title,
        subtitle: input.subtitle,
        needHeroImg,
    });

    const renderedBlocks = input.blocks.map(renderBlock);

    const contentBlock = `
<table
    role="presentation"
    cellpadding="0"
    cellspacing="0"
    border="0"
    width="100%"
    style="${inlineStyle({
        width: '100%',
        borderCollapse: 'collapse',
        background: emailTheme.colors.containerBg,
    })}"
>
    <tr>
        <td
            style="${inlineStyle({
        padding: '20px 0 0 0',
    })}"
        >
            ${renderedBlocks.map((b) => b.html).join('')}
        </td>
    </tr>
</table>
`;

    const footerNoteBlock = input.footerNote
        ? `
        <tr>
            <td
                align="center"
                style="padding: 52px 60px 24px"
            >
                <div
                    style="
                        color: ${emailTheme.colors.primary};
                        font-family: ${emailTheme.typography.fontFamily};
                        font-size: 26px;
                        line-height: 26px;
                        font-weight: 500;
                        text-transform: uppercase;
                        letter-spacing: 0;
                        text-align: center;
                        mso-line-height-rule: exactly;
                    "
                >
                    ${escapeHtml(input.footerNote)}
                </div>
            </td>
        </tr>
    `
        : '';

    const body = joinHtml([
        heroBlock,
        contentBlock,
        footerNoteBlock,
    ]);

    return {
        subject: input.subject,
        html: renderEmailLayout({
            preheader: input.preheader ?? input.subject,
            content: body,
        }),
        text: renderedBlocks
            .map((b) => b.text)
            .filter(Boolean)
            .join('\n\n'),
    };
}