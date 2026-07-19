import { Inject, Injectable } from '@nestjs/common';
import {
  OfferClientView,
  GetOffersParamsDto,
} from './dto/get-offers.dto';
import { GET_OFFERS_SERVICE, GetOffersService } from './services/get-offers.service';

@Injectable()
export class OffersService {
  constructor(
    @Inject(GET_OFFERS_SERVICE)
    private readonly getOffersService: GetOffersService
  ) { }

  getPublishedOffersByGenreAndSocialMedia(
    data: GetOffersParamsDto,
  ): Promise<OfferClientView[]> {
    return this.getOffersService.exec({ ...data, onlyPublished: true });
  }
}
