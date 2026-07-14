import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Param,
  ParseBoolPipe,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Auth } from '../../../common/decorators/auth.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/types/user.types';
import {
  ApiBody,
  ApiConsumes,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/decorators/api/response/api-response.decorator';
import { AdminOffersService } from '../services/admin-offers.service';
import {
  AdminCreateOfferDto,
  AdminOffersMatrixDto,
  AdminOffersMatrixToggleLinkDto,
  GetAdminOffersMatrixQuery,
  UpdateOfferFieldDto,
} from '../dto/offers/admin-offers-matrix.dto';
import { ParseObjectIdPipe } from '../../../common/pipes/parse-oid.pipe';
import { SocialMediaEnum } from '../../../common/types/social-media.types';
import { FileInterceptor } from '@nestjs/platform-express';
import { XlsxOffersImportSummary } from '../dto/offers/xlsx-offers-import.dto';
import { OfferSocialMediaEnum } from 'src/common/types/offer.types';
import { CommunityMusicGenres, CreatorMusicGenres } from 'src/common/types/influencer/influencer.types';

const MUSIC_GENRE_VALUES = [
  ...Object.values(CommunityMusicGenres),
  ...Object.values(CreatorMusicGenres),
];

@Auth()
@Roles(Role.admin)
@ApiTags('admin/offers')
@Controller('admin/offers')
@Injectable()
export class AdminOffersController {
  constructor(private readonly adminOffersService: AdminOffersService) {}

  @ApiOperation({ summary: 'Cursor-paginated offers × accounts matrix (links for viewport)' })
  @ApiResponseDto(AdminOffersMatrixDto)
  @Get()
  getMatrix(@Query() query: GetAdminOffersMatrixQuery): Promise<AdminOffersMatrixDto> {
    return this.adminOffersService.getMatrix(query);
  }

  @ApiOperation({ summary: 'Create a new empty offer' })
  @ApiResponseDto(undefined, {successStatusCode: 201})
  @Post()
  create(@Body() data: AdminCreateOfferDto): Promise<void> {
    return this.adminOffersService.createOffer(data);
  }

  @ApiOperation({ summary: 'Set offer isPublished (visible to clients)' })
  @ApiResponseDto()
  @ApiParam({
    name: 'socialMedia',
    type: String,
    enum: OfferSocialMediaEnum,
    required: true,
  })
  @ApiParam({
    name: 'genre',
    type: String,
    enum: MUSIC_GENRE_VALUES,
    required: true,
  })
  @Patch('change-published-status/:socialMedia/:genre')
  setPublished(
    @Param('socialMedia', new ParseEnumPipe(OfferSocialMediaEnum)) socialMedia: OfferSocialMediaEnum,
    @Param('genre', new ParseEnumPipe(MUSIC_GENRE_VALUES)) genre: CommunityMusicGenres | CreatorMusicGenres
   ): Promise<void> {
    return this.adminOffersService.changePublishedStatuses(socialMedia, genre);
  }

  @ApiOperation({ summary: 'Add or remove one account–offer link' })
  @ApiParam({
    name: 'offerId',
    type: String,
    required: true,
  })
  @ApiParam({
    name: 'influencerId',
    type: String,
    required: true,
  })
  @ApiParam({
    name: 'accountId',
    type: String,
    required: true,
  })
  @ApiParam({
    name: 'connected',
    type: Boolean,
    required: true,
  })
  @Patch(':offerId/links/:influencerId/:accountId/:connected')
  toggleLink(
    @Param('offerId', new ParseObjectIdPipe()) offerId: string,
    @Param('influencerId', new ParseObjectIdPipe()) influencerId: string,
    @Param('accountId', new ParseObjectIdPipe()) accountId: string,
    @Param('connected', new ParseBoolPipe()) connected: boolean,
  ): Promise<void> {
    const payload = {
      offerId,
      influencerId,
      accountId,
      connected,
    } satisfies AdminOffersMatrixToggleLinkDto;

    return this.adminOffersService.toggleLink(payload);
  }

  @ApiOperation({ summary: "Updates one offer's field" })
  @ApiResponseDto()
  @ApiParam({
    name: 'offerId',
    type: String,
    required: true,
  })
  @Patch(':offerId')
  updateField(
    @Param('offerId', new ParseObjectIdPipe()) offerId: string,
    @Body() payload: UpdateOfferFieldDto,
  ): Promise<void> {
    return this.adminOffersService.updateField(offerId, payload);
  }

  @ApiOperation({ summary: 'Import xlsx file with new offers' })
  @ApiResponseDto()
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'socialMedia',
    type: String,
    enum: SocialMediaEnum,
    required: true,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @Post(':socialMedia/xlsx')
  importXlsxOffers(
    @Param('socialMedia', new ParseEnumPipe(OfferSocialMediaEnum))
    socialMedia: OfferSocialMediaEnum,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<XlsxOffersImportSummary> {
    return this.adminOffersService.importXlsxOffers(socialMedia, file);
  }

  @ApiOperation({ summary: 'Permanently deletes offer' })
  @ApiResponseDto()
  @ApiParam({
    name: 'offerId',
    type: String,
    required: true,
  })
  @Delete(':offerId')
  delete(@Param('offerId', new ParseObjectIdPipe()) offerId: string): Promise<void> {
    return this.adminOffersService.deleteOffer(offerId);
  }
}
