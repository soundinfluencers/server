type StyleValue = string | number | undefined | null | false;

type StyleMap = Record<string, StyleValue>;

const UNITLESS_PROPERTIES = new Set([
    'font-weight',
    'line-height',
    'opacity',
    'z-index',
    'mso-hide',
]);

function toKebabCase(value: string): string {
    return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function normalizeStyleValue(property: string, value: StyleValue): string {
    if (value === undefined || value === null || value === false) return '';

    if (typeof value === 'number') {
        if (UNITLESS_PROPERTIES.has(property)) {
            return String(value);
        }

        return `${value}px`;
    }

    return value;
}

export function inlineStyle(styles: StyleMap): string {
    return Object.entries(styles)
        .map(([property, value]) => {
            const cssProperty = toKebabCase(property);
            const cssValue = normalizeStyleValue(cssProperty, value);

            if (!cssValue) return '';

            return `${cssProperty}:${cssValue}`;
        })
        .filter(Boolean)
        .join(';');
}