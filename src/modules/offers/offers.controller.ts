import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { ImportXlsxOffersDto } from './dto/import-xlsx-offers.dto';
import { ChangeOfferDeletedStatusDto } from './dto/change-offer-deleted-status.dto';
import { Types } from 'mongoose';
import {SocialMediaEnum, SocialMediaType} from "../../common/types/social-media.types";
import {allowedGenresMap} from "../../common/types/genres.types";

@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get('get/published/:socialMedia/:genre')
  getPublishedOffersByGenreAndSocialMedia(
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

    return this.offersService.getPublishedOffersByGenreAndSocialMedia(
      socialMedia as SocialMediaType,
      genre,
    );
  }

  @Get('get/all/:socialMedia/:genre')
  getAllOffersByGenreAndSocialMedia(
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

    return this.offersService.getAllOffersByGenreAndSocialMedia(
      socialMedia as SocialMediaType,
      genre,
    );
  }

  @Post('create/one')
  async createNewOffer(@Body() data: any) {
    try {
      const formattedOffer = await this.offersService.formatOfferBeforeSaving(
        data,
        new Types.ObjectId(),
      );
      return this.offersService.createOffer(formattedOffer);
    } catch (err) {
      console.error(
        new Date().toISOString(),
        `Error creating new offer: ${data.title}`,
        err instanceof Error ? err.stack : new Error().stack,
      );
      return {
        code: 500,
        message: err.message,
      };
    }
  }

  @Put('update/one/:id')
  async updateOfferById(@Param('id') id: string, @Body() data: any) {
    try {
      const formattedOffer = await this.offersService.formatOfferBeforeSaving(
        data,
        new Types.ObjectId(id),
      );
      return this.offersService.findAndReplaceOffer(formattedOffer);
    } catch (err) {
      console.error(
        new Date().toISOString(),
        `Error updating offer: ${data.title}`,
        err instanceof Error ? err.stack : new Error().stack,
      );
      return {
        code: 500,
        message: err.message,
      };
    }
  }

  @Post('create/xlsx')
  @UsePipes(new ValidationPipe({ transform: true }))
  importXlsxOffers(@Body() data: ImportXlsxOffersDto) {
    return this.offersService.importXlsxOffers(data.offers);
  }

  @Put('change-status/deleted')
  @UsePipes(new ValidationPipe({ transform: true }))
  changeOfferDeletedStatus(@Body() data: ChangeOfferDeletedStatusDto) {
    return this.offersService.changeOfferDeletedStatus(data);
  }

  @Delete('delete/:offerId')
  deleteOfferPermanently(@Param('offerId') offerId: string) {
    if (!offerId) {
      return {
        code: 404,
        message: `Invalid offerId - ${offerId}`,
      };
    }

    return this.offersService.deleteOfferPermanently(offerId);
  }

  @Put('publish/all')
  publishAllOffers() {
    return this.offersService.publishAllOffers();
  }
}
