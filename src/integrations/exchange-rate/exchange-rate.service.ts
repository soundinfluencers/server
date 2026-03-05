import { Injectable, Inject, Logger } from '@nestjs/common';
import axios from 'axios';
import {
    EXCHANGE_RATE_REPOSITORY,
    IExchangeRateRepository
} from "./database/repositories/exchange-rate.repository";
import {CurrencyCode} from "../../common/types/finance.types";

@Injectable()
export class ExchangeRateService {
    private readonly logger = new Logger(ExchangeRateService.name);

    constructor(
        @Inject(EXCHANGE_RATE_REPOSITORY)
        private readonly exchangeRateRepository: IExchangeRateRepository,
    ) {}

    // Fetch & save today's exchange rate for currencies
    async fetchAndSaveDailyRates(dateOverride?: string) {
        const apiKey = process.env.EXCHANGE_API_KEY;
        const base = (process.env.EXCHANGE_BASE || 'EUR').toUpperCase();
        const symbols = (process.env.EXCHANGE_SYMBOLS || 'USD,EUR,GBP')
            .split(',')
            .map(s => s.trim().toUpperCase())
            .filter(Boolean);

        const url = `${process.env.EXCHANGE_API_URL}/${apiKey}/latest/${base}`;
        const { data } = await axios.get(url, { timeout: 15000 });

        if (!data?.conversion_rates) throw new Error('Exchange API response has no conversion_rates');

        const date =
            dateOverride ??
            (data.time_last_update_utc
                ? new Date(data.time_last_update_utc).toISOString().slice(0, 10)
                : new Date().toISOString().slice(0, 10));

        let saved = 0;

        for (const currency of symbols) {
            const rate = currency === base ? 1 : data.conversion_rates[currency];
            if (typeof rate !== 'number') continue;

            await this.exchangeRateRepository.upsertDailyRate({
                currency,
                base,
                rate,
                date,
            });

            saved++;
        }

        this.logger.log(`Exchange rates saved: ${saved}/${symbols.length} for ${date} base=${base}`);
        return { date, base, requested: symbols.length, saved };
    }

    // Returns exchange rate for one currency
    async getRate(from: string, to: string): Promise<number> {
        from = from.toUpperCase();
        to = to.toUpperCase();

        if (from === to) return 1;

        const fromRate = await this.exchangeRateRepository.findLatestByCurrency(from);
        const toRate = await this.exchangeRateRepository.findLatestByCurrency(to);

        if (!fromRate || !toRate) {
            throw new Error('Rate not found');
        }

        return toRate.rate / fromRate.rate;
    }

    // Returns exchange rate for all of available currencies
    async getAllRates(): Promise<Record<CurrencyCode, number>> {
        const availableCurrencies = Object.values(CurrencyCode) as CurrencyCode[];

        const result = {} as Record<CurrencyCode, number>;

        for (const currency of availableCurrencies) {
            const exchangeRate = await this.exchangeRateRepository.findLatestByCurrency(currency);

            if (!exchangeRate) {
                throw new Error(`Exchange rate not found for ${currency}`);
            }

            result[currency] = exchangeRate.rate;
        }

        return result;
    }
}