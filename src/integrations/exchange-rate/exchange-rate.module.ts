import {Global, Module} from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExchangeRate, ExchangeRateSchema } from './database/schemas/exchange-rate.schema';
import { ExchangeRateService } from './exchange-rate.service';
import {
    EXCHANGE_RATE_REPOSITORY,
    ExchangeRateRepository
} from './database/repositories/exchange-rate.repository';

@Global()
@Module({
    imports: [
        MongooseModule.forFeature([
            { name: ExchangeRate.name, schema: ExchangeRateSchema },
        ]),
    ],
    providers: [
        ExchangeRateService,
        { provide: EXCHANGE_RATE_REPOSITORY, useClass: ExchangeRateRepository },
    ],
    exports: [ExchangeRateService],
})
export class ExchangeRateModule {}