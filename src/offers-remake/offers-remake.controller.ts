import { Body, Controller, Get, Param, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { OffersRemakeService } from './offers-remake.service';
import { ImportXlsxOffersDto } from './dto/import-xlsx-offers.dto';
import { SocialMediaEnum, SocialMediaType } from '../types/social-media.types';
import { allowedGenresMap } from '../types/genres.types';

@Controller('offers')
export class OffersRemakeController {
  constructor(private readonly offersRemakeService: OffersRemakeService) {}

  @Get('get/all/:socialMedia/:genre')
  getOffersByGenreAndSocialMedia(
    @Param('socialMedia') socialMedia: string,
    @Param('genre') genre: string,
  ) {
    const allowedSocialMedia = Object.values(SocialMediaEnum);

    if (!allowedSocialMedia.includes(socialMedia as SocialMediaEnum)) {
      return {
        code: 404,
        message: `Invalid social media - ${socialMedia}`,
        offers: null,
      };
    }

    const allowedGenres = allowedGenresMap[socialMedia as SocialMediaEnum];

    if (!allowedGenres) {
      return {
        code: 404,
        message: `No genres configured for social media - ${socialMedia}`,
        offers: null,
      };
    }

    if (!allowedGenres.includes(genre)) {
      return {
        code: 404,
        message: `Invalid genre "${genre}" for social media "${socialMedia}"`,
        offers: null,
      };
    }

    return this.offersRemakeService.getOffersByGenreAndSocialMedia(
      socialMedia as SocialMediaType,
      genre,
    );
  }

  @Post('create/xlsx')
  @UsePipes(new ValidationPipe({ transform: true }))
  importXlsxOffers(@Body() data: ImportXlsxOffersDto) {
    return this.offersRemakeService.importXlsxOffers(data.offers);
  }
}
