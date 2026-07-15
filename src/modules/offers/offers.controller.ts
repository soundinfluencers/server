import { Controller, Get, Param } from '@nestjs/common';
import { OffersService } from './offers.service';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../common/decorators/auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/user.types';
import {
  FilteredPublishedOffersByGenreAndSocialMedia,
  GetFilteredPublishedOffers,
} from './dto/get-offers.dto';
import { ApiResponseDto } from '../../common/decorators/api/response/api-response.decorator';
import { OfferSocialMediaEnum } from 'src/common/types/offer.types';

@ApiTags('offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Auth()
  @Roles(Role.client, Role.admin)
  @ApiOperation({ summary: 'Get published filtered (by socialMedia and genre) offers' })
  @ApiParam({
    name: 'socialMedia',
    required: true,
    type: 'string',
    enum: OfferSocialMediaEnum,
  })
  @ApiParam({
    name: 'genre',
    type: 'string',
    description: 'Must be allowed for the given socialMedia (allowedGenresMap).',
    required: true,
  })
  @ApiResponseDto(FilteredPublishedOffersByGenreAndSocialMedia)
  @Get('published/:socialMedia/:genre')
  getPublishedOffersByGenreAndSocialMedia(
    @Param() params: GetFilteredPublishedOffers,
  ): Promise<FilteredPublishedOffersByGenreAndSocialMedia[]> {
    return this.offersService.getPublishedOffersByGenreAndSocialMedia(params);
  }
}
