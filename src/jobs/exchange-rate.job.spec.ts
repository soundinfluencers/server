import { ExchangeRateService } from '../integrations/exchange-rate/exchange-rate.service';
import { ExchangeRateJob } from './exchange-rate.job';

describe('ExchangeRateJob startup', () => {
  const productionEnv = { ...process.env, NODE_ENV: 'production' };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['true', 0],
    ['false', 1],
  ])('with CODEX_ISOLATED=%s makes %i startup requests', async (isolated, calls) => {
    jest.replaceProperty(process, 'env', {
      ...productionEnv,
      CODEX_ISOLATED: isolated,
    });
    const fetchAndSaveDailyRates = jest.fn().mockResolvedValue(undefined);
    const job = new ExchangeRateJob({
      fetchAndSaveDailyRates,
    } as unknown as ExchangeRateService);

    await job.onModuleInit();

    expect(fetchAndSaveDailyRates).toHaveBeenCalledTimes(calls);
  });
});
