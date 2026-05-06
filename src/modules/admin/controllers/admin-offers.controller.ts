import {
    Body,
    Controller,
    Delete,
    Get,
    Injectable,
    Param,
    ParseBoolPipe,
    Patch,
    Query,
    UsePipes,
    ValidationPipe
} from '@nestjs/common';
import {Auth} from '../../../common/decorators/auth.decorator';
import {Roles} from '../../../common/decorators/roles.decorator';
import {Role} from '../../../common/types/user.types';
import {ApiExcludeEndpoint, ApiOperation, ApiParam, ApiQuery, ApiTags} from '@nestjs/swagger';
import {ApiResponseDto} from '../../../common/decorators/api/response/api-response.decorator';
import {AdminOffersService} from '../services/admin-offers.service';
import {
    AdminOffersMatrixDto,
    AdminOffersMatrixToggleLinkDto,
    GetAdminOffersMatrixQuery, UpdateOfferFieldDto,
} from '../dto/offers/admin-offers-matrix.dto';
import {ParseObjectIdPipe} from "../../../common/pipes/parse-oid.pipe";

@Auth()
@Roles(Role.admin)
@ApiTags('admin/offers')
@Controller('admin/offers')
@Injectable()
export class AdminOffersController {
    constructor(private readonly adminOffersService: AdminOffersService) {
    }

    @ApiOperation({summary: 'Cursor-paginated offers × accounts matrix (links for viewport)'})
    @ApiResponseDto(AdminOffersMatrixDto)
    @Get()
    getMatrix(@Query() query: GetAdminOffersMatrixQuery): Promise<AdminOffersMatrixDto> {
        return this.adminOffersService.getMatrix(query);
    }

    @ApiOperation({summary: 'Set offer isPublished (visible to clients)'})
    @ApiResponseDto()
    @ApiQuery({
        name: 'offerId',
        type: String,
        required: false
    })
    @Patch('published')
    setPublished(@Query('offerId') offerId?: string): Promise<void> {
        return this.adminOffersService.setPublishedStatus(offerId);
    }

    @ApiOperation({summary: 'Add or remove one account–offer link'})
    @ApiParam({
        name: 'offerId',
        type: String,
        required: true
    })
    @ApiParam({
        name: 'influencerId',
        type: String,
        required: true
    })
    @ApiParam({
        name: 'accountId',
        type: String,
        required: true
    })
    @ApiParam({
        name: 'connected',
        type: Boolean,
        required: true
    })
    @Patch(':offerId/links/:influencerId/:accountId/:connected')
    toggleLink(
        @Param('offerId', new ParseObjectIdPipe()) offerId: string,
        @Param('influencerId', new ParseObjectIdPipe()) influencerId: string,
        @Param('accountId', new ParseObjectIdPipe()) accountId: string,
        @Param('connected', new ParseBoolPipe()) connected: boolean,
    ): Promise<{ ok: boolean }> {
        const payload = {
            offerId,
            influencerId,
            accountId,
            connected
        } satisfies AdminOffersMatrixToggleLinkDto;

        return this.adminOffersService.toggleLink(payload);
    }

    @ApiExcludeEndpoint()
    @ApiOperation({summary: "Updates one offer's field"})
    @ApiResponseDto()
    @ApiParam({
        name: 'offerId',
        type: String,
        required: true
    })
    @Patch(':offerId')
    updateField(
        @Param('offerId', new ParseObjectIdPipe()) offerId: string,
        @Body() payload: UpdateOfferFieldDto
    ): Promise<void> {
        return this.adminOffersService.updateField(offerId, payload);
    }

    @ApiOperation({summary: 'Permanently deletes offer'})
    @ApiResponseDto()
    @ApiParam({
        name: 'offerId',
        type: String,
        required: true
    })
    @Delete(':offerId')
    delete(@Param('offerId', new ParseObjectIdPipe()) offerId: string): Promise<void> {
        return this.adminOffersService.deleteOffer(offerId);
    }
}
