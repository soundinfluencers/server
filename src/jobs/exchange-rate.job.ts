import {Injectable, Logger, OnModuleInit} from '@nestjs/common';
import {Cron} from '@nestjs/schedule';
import {ExchangeRateService} from '../integrations/exchange-rate/exchange-rate.service';

@Injectable()
export class ExchangeRateJob implements OnModuleInit {
    private readonly logger = new Logger(ExchangeRateJob.name);
    private isRunning = false;

    constructor(private readonly exchangeRateService: ExchangeRateService) {
    }

    private async runSafe(source: string) {
        if (this.isRunning) {
            this.logger.warn(`${source}: skipped (already running)`);
            return;
        }

        this.isRunning = true;
        try {
            await this.exchangeRateService.fetchAndSaveDailyRates();
            this.logger.log(`${source}: done`);
        } catch (e: any) {
            this.logger.error(`${source} failed: ${e?.message || e}`, e?.stack);
        } finally {
            this.isRunning = false;
        }
    }

    async onModuleInit() {
        // The startup fetch runs independently of the Nest scheduler.
        if (process.env.NODE_ENV === 'production' && process.env.CODEX_ISOLATED !== 'true') {
            await this.runSafe('Exchange rate: initialFetch');
        }
    }

    @Cron('0 0 0 * * *', {timeZone: 'Europe/Kyiv'})
    async dailyFetch() {
        await this.runSafe('Exchange rate: dailyFetch');
    }

    @Cron('0 0 * * * *', {timeZone: 'Europe/Kyiv'})
    async hourlyRecovery() {
        await this.runSafe('Exchange rate: hourlyRecovery');
    }
}
