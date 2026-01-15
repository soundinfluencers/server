import {Body, Controller, Delete, Get, Param, Post, Put, UsePipes, ValidationPipe,} from '@nestjs/common';
import {OffersService} from './offers.service';
import {ImportXlsxOffersDto} from './dto/import-xlsx-offers.dto';
import {ChangeOfferDeletedStatusDto} from './dto/change-offer-deleted-status.dto';
import {Types} from 'mongoose';
import {SocialMediaEnum, SocialMediaType} from "../../common/types/social-media.types";
import {allowedGenresMap} from "../../common/types/genres.types";
import {ApiExcludeEndpoint, ApiOperation, ApiParam, ApiTags} from "@nestjs/swagger";
import {Auth} from "../../common/decorators/auth.decorator";
import {Roles} from "../../common/decorators/roles.decorator";
import {Role} from "../../common/types/auth.types";
import {GetFilteredPublishedOffers} from "./dto/get-offers.dto";

@ApiTags('offers')
@Controller('offers')
export class OffersController {
    constructor(private readonly offersService: OffersService) {
    }

    @Auth()
    @Roles(Role.client, Role.admin)
    @ApiOperation({summary: 'Get published filtered (by socialMedia and genre) offers'})
    @ApiParam({
        name: 'socialMedia',
        required: true,
        type: 'string',
        enum: SocialMediaEnum,
    })
    @ApiParam({
        name: 'genre',
        type: 'string',
        enum: [
            'Techno (Melodic, Minimal)',
            'Techno (Hard, Peak)',
            'House (Tech House)',
            'House (Melodic, Afro)',
            'EDM',
            'D&B',
            'Bass',
            'Psy, Trance',
            'Dubstep',
            'Garage',
            'Dance Pop',
        ],
        required: true,
    })
    @Get('published/:socialMedia/:genre')
    getPublishedOffersByGenreAndSocialMedia(@Param() params: GetFilteredPublishedOffers) {
        return this.offersService.getPublishedOffersByGenreAndSocialMedia(params);
    }

    @ApiExcludeEndpoint()
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

    @ApiExcludeEndpoint()
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

    @ApiExcludeEndpoint()
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

    @ApiExcludeEndpoint()
    @Post('create/xlsx')
    @UsePipes(new ValidationPipe({transform: true}))
    importXlsxOffers(@Body() data: ImportXlsxOffersDto) {
        return this.offersService.importXlsxOffers(data.offers);
    }

    @ApiExcludeEndpoint()
    @Put('change-status/deleted')
    @UsePipes(new ValidationPipe({transform: true}))
    changeOfferDeletedStatus(@Body() data: ChangeOfferDeletedStatusDto) {
        return this.offersService.changeOfferDeletedStatus(data);
    }

    @ApiExcludeEndpoint()
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

    @ApiExcludeEndpoint()
    @Put('publish/all')
    publishAllOffers() {
        return this.offersService.publishAllOffers();
    }
}
