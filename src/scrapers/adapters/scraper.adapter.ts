export interface ScraperAdapter<TNormalized = any> {
    runPostDetailsScraper(urls: string[]): Promise<TNormalized[]>;
    runAccountDetailsScraper(urls: string[]): Promise<TNormalized[]>;

    normalizePostDetailsItem(item: any): TNormalized;
    normalizeAccountDetailsItem(item: any): TNormalized;
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

/** Хэлпер который помогает найти результат скрэйпинга поста и дать ему правильный тип */
export function findScrapedAccountDetailsMatch<T extends ScraperAdapter<any>>(
    items: NormalizedAccountDetailsItem<T>[],
    acc: { accountLink: string }
): NormalizedPostDetailsItem<T> | undefined {
    return items.find(i => i.url === acc.accountLink);
}