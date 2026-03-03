import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../../../../database/repositories/base.repository";
import {ExchangeRate, ExchangeRateDocument} from "../schemas/exchange-rate.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

export type CreateExchangeRateInput = Pick<ExchangeRate, 'currency' | 'base' | 'rate' | 'date'>;

// Interface for exchange rate repository
export interface IExchangeRateRepository {
    upsertDailyRate(input: CreateExchangeRateInput): Promise<ExchangeRateDocument>;
    findLatestByCurrency(currency: string, base?: string): Promise<ExchangeRateDocument | null>;
    findByCurrencyAndDate(currency: string, date: string, base?: string): Promise<ExchangeRateDocument | null>;
}

@Injectable()
export class ExchangeRateRepository extends BaseRepository<ExchangeRateDocument> implements IExchangeRateRepository {
    constructor(
        @InjectModel(ExchangeRate.name)
        private readonly exchangeRateModel: Model<ExchangeRateDocument>,
    ) {
        super(exchangeRateModel);
    }

    upsertDailyRate(input: CreateExchangeRateInput): Promise<ExchangeRateDocument> {
        const currency = input.currency.toUpperCase();
        const base = (input.base ?? 'EUR').toUpperCase();

        return this.exchangeRateModel
            .findOneAndUpdate(
                { currency, base, date: input.date },
                {
                    $set: { rate: input.rate },
                    $setOnInsert: { currency, base, date: input.date },
                },
                { upsert: true, new: true }
            )
            .exec();
    }

    async findLatestByCurrency(currency: string, base = 'EUR'): Promise<ExchangeRateDocument | null> {
        return this.exchangeRateModel
            .findOne({ currency: currency.toUpperCase(), base })
            .sort({ createdAt: -1 })
            .exec();
    }

    async findByCurrencyAndDate(currency: string, date: string, base = 'EUR'): Promise<ExchangeRateDocument | null> {
        return this.exchangeRateModel
            .findOne({ currency: currency.toUpperCase(), base, date })
            .exec();
    }
}

export const EXCHANGE_RATE_REPOSITORY = Symbol('EXCHANGE_RATE_REPOSITORY');