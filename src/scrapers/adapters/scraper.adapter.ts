export interface ScraperAdapter<
    TPostNormalized = any,
    TAccountNormalized = any
> {
    runPostDetailsScraper(urls: string[]): Promise<TPostNormalized[]>;
    runAccountDetailsScraper(urls: string[]): Promise<TAccountNormalized[]>;

    normalizePostDetailsItem(item: any): TPostNormalized;
    normalizeAccountDetailsItem(item: any): TAccountNormalized;
}

type NormalizedPostDetailsItem<T extends ScraperAdapter<any>> =
    Awaited<ReturnType<T['runPostDetailsScraper']>>[number];

type NormalizedAccountDetailsItem<T extends ScraperAdapter<any>> =
    Awaited<ReturnType<T['runAccountDetailsScraper']>>[number];

/** Хэлпер который помогает найти результат скрэйпинга поста и дать ему правильный тип */
export function findScrapedPostDetailsMatch<T extends ScraperAdapter<any>>(
    items: NormalizedPostDetailsItem<T>[],
    acc: { postLink: string }
): NormalizedPostDetailsItem<T> | undefined {
    return items.find(i => i.url === acc.postLink);
}

/** Хэлпер который помогает найти результат скрэйпинга аккаунта и дать ему правильный тип */
export function findScrapedAccountDetailsMatch<T extends ScraperAdapter<any>>(
    items: NormalizedAccountDetailsItem<T>[],
    acc: { accountLink: string }
): NormalizedAccountDetailsItem<T> | undefined {
    return items.find(i => i.url === acc.accountLink);
}