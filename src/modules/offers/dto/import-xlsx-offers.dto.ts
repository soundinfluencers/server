import { ArrayNotEmpty, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { OfferDto } from './offer.dto';

export class ImportXlsxOffersDto {
  @IsArray({
    message: 'Offers list must be an array',
  })
  @ArrayNotEmpty({
    message: 'Offers list can not be empty',
  })
  @Type(() => OfferDto)
  offers: OfferDto[];
}
