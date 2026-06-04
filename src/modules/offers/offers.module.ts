import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import {ExchangeRateModule} from "../../integrations/exchange-rate/exchange-rate.module";

@Module({
  imports: [
    ExchangeRateModule,
  ],
  controllers: [OffersController],
  providers: [
    OffersService,
  ],
  exports: [
    OffersService,
  ],
})
export class OffersModule {}