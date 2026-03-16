import { emailTheme } from '../core/email-theme';
import { escapeHtml } from '../core/email.utils';
import { inlineStyle } from '../core/email-style';

export type InlineStyleObject = Record<string, string | number>;

export type ListItem =
    | {
    type: 'text';
    text: string;
}
    | {
    type: 'html';
    html: string;
    text?: string;
};

type RenderListParams = {
    title?: string;
    items: Array<string | ListItem>;
    bulletImg?: string;
    titleStyle?: InlineStyleObject;
    itemStyle?: InlineStyleObject;
    wrapperStyle?: InlineStyleObject;
    disableBullets?: boolean;
};

function normalizeListItem(item: string | ListItem): ListItem {
    if (typeof item === 'string') {
        return {
            type: 'text',
            text: item,
        };
    }

    return item;
}

export function renderList(params: RenderListParams): string {
    const {
        title,
        items,
        bulletImg = 'cid:list_check',
        titleStyle,
        itemStyle,
        wrapperStyle,
        disableBullets = false,
    } = params;

    if (!items.length) return '';

    const defaultTitleStyle: InlineStyleObject = {
        margin: '48px 0 18px 0',
        fontFamily: emailTheme.typography.fontFamily,
        fontWeight: 400,
        fontSize: 26,
        lineHeight: '26px',
        letterSpacing: '0',
        color: emailTheme.colors.text,
        textTransform: 'uppercase',
    };

    const defaultItemStyle: InlineStyleObject = {
        padding: '0 0 16px 0',
        fontFamily: emailTheme.typography.fontFamily,
        fontWeight: 400,
        fontSize: 20,
        lineHeight: '20px',
        letterSpacing: '0',
        color: emailTheme.colors.text,
    };

    const listItems = items
        .map((rawItem) => {
            const item = normalizeListItem(rawItem);

            const itemContent =
                item.type === 'html'
                    ? item.html
                    : escapeHtml(item.text);

            if (disableBullets) {
                return `
                    <tr>
                        <td
                            valign="top"
                            style="${inlineStyle({
                    ...defaultItemStyle,
                    ...itemStyle,
                })}"
                        >
                            ${itemContent}
                        </td>
                    </tr>
                `;
            }

            return `
                <tr>
                    <td
                        valign="top"
                        width="20"
                        style="${inlineStyle({
                width: 22,
                padding: '0 8px 16px 0',
            })}"
                    >
                        <img
                            src="${bulletImg}"
                            alt=""
                            width="22"
                            height="22"
                            style="${inlineStyle({
                display: 'block',
                width: 22,
                height: 22,
                border: 0,
                marginTop: 0,
                cursor: 'none',
            })}"
                        />
                    </td>
                    <td
                        valign="top"
                        style="${inlineStyle({
                ...defaultItemStyle,
                ...itemStyle,
            })}"
                    >
                        ${itemContent}
                    </td>
                </tr>
            `;
        })
        .join('');

    const titleBlock = title
        ? `
        <div style="${inlineStyle({
            ...defaultTitleStyle,
            ...titleStyle,
        })}">
            ${escapeHtml(title)}
        </div>
        `
        : '';

    return `
        <div style="${inlineStyle({
        ...wrapperStyle,
    })}">
            ${titleBlock}
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
                ${listItems}
            </table>
        </div>
    `;
}