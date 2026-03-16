export const emailTheme = {
    colors: {
        bodyBg: '#eef2f6',
        containerBg: '#ffffff',
        heroBg: '#eaf2fb',
        cardBg: '#eef5ff',
        primary: '#071530',
        text: '#1f2937',
        muted: '#6b7280',
        border: '#d9e4f2',
        white: '#ffffff',
        secondBtn: '#ECEEF0'
    },
    layout: {
        maxWidth: 1440,
        radius: 12,
        outerPadding: 24,
        innerPadding: 24,
    },
    typography: {
        fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif",
        titleSize: 72,
        subtitleSize: 24,
        bodySize: 24,
        smallSize: 16,
        lineHeight: 1.6,
    },
    spacing: {
        xs: 8,
        sm: 12,
        md: 16,
        lg: 24,
        xl: 32,
    },
} as const;