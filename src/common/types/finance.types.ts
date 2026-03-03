// Website available currencies
export enum CurrencyCode {
    EUR = 'EUR',
    USD = 'USD',
    GBP = 'GBP',
}

export const CurrencyMeta: Record<CurrencyCode, { symbol: string }> = {
    [CurrencyCode.EUR]: { symbol: '€' },
    [CurrencyCode.USD]: { symbol: '$' },
    [CurrencyCode.GBP]: { symbol: '£' },
};

export function getCurrencySymbol(code: CurrencyCode): string {
    return CurrencyMeta[code].symbol;
}

export function getCurrencyCodeBySymbol(symbol: string): CurrencyCode | null {
    const entry = Object.entries(CurrencyMeta)
        .find(([, value]) => value.symbol === symbol);

    return entry ? (entry[0] as CurrencyCode) : null;
}
export function getAvailableCurrenciesLabel(): string {
    return Object.entries(CurrencyMeta)
        .map(([code, meta]) => `${code} (${meta.symbol})`)
        .join(', ');
}