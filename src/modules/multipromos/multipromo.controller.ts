import { Controller, Get, Param } from '@nestjs/common';
import { MultiPromoService } from './multipromo.service';
import {ApiTags} from "@nestjs/swagger";

@ApiTags('multi-promo')
@Controller('multi-promo')
export class MultiPromoController {
  constructor(private readonly multiPromoService: MultiPromoService) {}

  @Get('accounts/:socialMedias')
  async getAccountsBySocialMedias(@Param('socialMedias') socialMedias: string) {
    const socialMediaArray = socialMedias.split(',');
    return this.multiPromoService.getAccountsBySocialMedias(socialMediaArray);
  }
}
