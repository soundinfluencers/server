import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { OffersRemakeService } from './offers-remake.service';
import { ImportXlsxOffersDto } from './dto/import-xlsx-offers.dto';

@Controller('offers')
export class OffersRemakeController {
  constructor(private readonly offersRemakeService: OffersRemakeService) {}

  @Post('create/xlsx')
  @UsePipes(new ValidationPipe({ transform: true }))
  importXlsxOffers(@Body() data: ImportXlsxOffersDto) {
    return this.offersRemakeService.importXlsxOffers(data.offers);
  }
}
