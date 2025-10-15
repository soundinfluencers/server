export interface ScraperAdapter<TNormalized = any> {
    runScraper(urls: string[]): Promise<TNormalized[]>;
    normalizeItem(item: any): TNormalized;
}

type NormalizedPostDetailsItem<T extends ScraperAdapter<any>> =
    Awaited<ReturnType<T['runScraper']>>[number];

// хэлпер который помогает найти результат скрэйпинга поста и дать ему правильный тип

export function findScrapedPostDetailsMatch<T extends ScraperAdapter<any>>(
    items: NormalizedPostDetailsItem<T>[],
    acc: { postLink: string }
): NormalizedPostDetailsItem<T> | undefined {
    return items.find(i => i.url === acc.postLink);
}