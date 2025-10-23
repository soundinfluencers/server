export const getSocialMediaGroup = (socialMedia: string): string => {
    if (['instagram', 'tiktok', 'facebook', 'youtube'].includes(socialMedia)) {
        return 'main';
    } else if (['spotify', 'soundcloud'].includes(socialMedia)) {
        return 'music';
    } else if (['press'].includes(socialMedia)) {
        return 'press';
    } else {
        return 'main';
    }
}

/** Очистка ссылки на тик ток профиль */
export function cleanAccountUrl(url: string, socialMedia: string): string {
    try {
        if (socialMedia === 'tiktok') {
            const parsed = new URL(url);
            const match = parsed.pathname.match(/^\/@[\w\.-]+/);
            if (match) {
                return `https://www.tiktok.com${match[0]}`;
            }
        }

        return url;
    } catch {
        return url;
    }
}