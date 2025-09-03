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