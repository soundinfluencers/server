import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import {ExchangeRateModule} from "../../integrations/exchange-rate/exchange-rate.module";
import { GET_OFFERS_SERVICE, GetOffersService } from './services/get-offers.service';

@Module({
  imports: [
    ExchangeRateModule,
  ],
  controllers: [OffersController],
  providers: [
    OffersService,
    {
      provide: GET_OFFERS_SERVICE,
      useClass: GetOffersService,
    },
  ],
  exports: [
    OffersService,
    {
      provide: GET_OFFERS_SERVICE,
      useClass: GetOffersService,
    },
  ],
})
export class OffersModule {}