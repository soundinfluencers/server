import { Module } from '@nestjs/common';
import { ExchangeRateJob } from './exchange-rate.job';

@Module({
    providers: [ExchangeRateJob],
})
export class JobsModule {}