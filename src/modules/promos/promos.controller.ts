import {
    Body,
    Controller,
    Get, Param,
    Patch,
    Query,
    Req,
    UnauthorizedException,
} from '@nestjs/common';
import {PromosService} from './promos.service';
import {ApiOperation, ApiParam, ApiQuery, ApiTags} from '@nestjs/swagger';
import {
    InfluencerCompletedPromoDto,
    InfluencerDashboardPromosDto, InfluencerDetailedPromo, InfluencerDetailedPromosDto,
    InfluencerGetDashboardPromosQueryDto, InfluencerGetDetailedPromoParamsDto,
    InfluencerNewPromoRequestsDto, InfluencerOngoingPromoDto, InfluencerUpdatePromoReqBodyDto,
    InfluencerUpdatePromoResponseUpdateDto,
} from "./dto/influencer-get-promos.dto";
import {AuthenticatedRequest, Role} from "../../common/types/auth.types";
import {Auth} from "../../common/decorators/auth.decorator";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";
import {Roles} from "../../common/decorators/roles.decorator";
import {
    InfluencerDashboardPromoStatusRequest, InfluencerDetailedPromoStatusRequest
} from "../../common/types/influencer/promo.types";
import {ApiResponseDtoOneOf} from "../../common/decorators/api/response/api-response-one-of.decorator";

@ApiTags('promos')
@Controller('promos')
export class PromosController {
    constructor(private readonly promosService: PromosService) {
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: 'Get influencer new promos requests'})
    @ApiResponseDto(InfluencerNewPromoRequestsDto)
    @Get('requests')
    async influencerGetNewPromos(@Req() request: AuthenticatedRequest): Promise<InfluencerNewPromoRequestsDto> {
        const promos = await this.promosService.getNewPromos(request.user._id);
        return ({promos});
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: `Returns influencer's promos for dashboard`})
    @ApiResponseDto(InfluencerDashboardPromosDto)
    @ApiQuery({
        name: 'status',
        required: false,
        enum: InfluencerDashboardPromoStatusRequest,
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: 'number',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: 'number',
    })
    @Get('/dashboard')
    async influencerGetDashboardPromos(@Req() request: AuthenticatedRequest, @Query() query: InfluencerGetDashboardPromosQueryDto): Promise<InfluencerDashboardPromosDto> {
        const promos = await this.promosService.getDashboardPromos({...query, influencerId: request.user._id});
        return ({promos});
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: `Returns influencer's detailed promos of one type`})
    @ApiResponseDto(InfluencerDetailedPromosDto)
    @ApiQuery({
        name: 'status',
        required: false,
        enum: InfluencerDetailedPromoStatusRequest,
    })
    @Get('/detailed')
    async influencerGetDetailedPromos(@Req() request: AuthenticatedRequest, @Query('status') query: InfluencerDetailedPromoStatusRequest): Promise<InfluencerDetailedPromosDto> {
        const promos = await this.promosService.getDetailedPromosByType(request.user._id, query);
        return ({promos});
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: `Returns influencer's detailed promo of one type`})
    @ApiResponseDtoOneOf([InfluencerOngoingPromoDto, InfluencerCompletedPromoDto])
    @ApiParam({
        name: 'status',
        type: 'string',
        enum: InfluencerDetailedPromoStatusRequest,
        required: true,
    })
    @ApiParam({
        name: 'campaignId',
        type: 'string',
        required: true,
    })
    @ApiParam({
        name: 'addedAccountsId',
        type: 'string',
        required: true,
    })
    @Get('/detailed/:status/:campaignId/:addedAccountsId')
    async getDetailedPromo(@Req() request: AuthenticatedRequest, @Param() params: InfluencerGetDetailedPromoParamsDto): Promise<InfluencerDetailedPromo> {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        return await this.promosService.getDetailedPromoByType({...params, influencerId: request.user._id});
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: `Update influencer's response to promo request`})
    @ApiResponseDto()
    @Patch('requests')
    influencerUpdateResponseToPromoRequest(
        @Body() body: InfluencerUpdatePromoResponseUpdateDto,
        @Req() request: AuthenticatedRequest,
    ) {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        const dataToUse = {
            ...body,
            influencerId: request.user._id,
        }

        return this.promosService.updateResponseNewCampaign(dataToUse);
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: "Close influencer's promo"})
    @ApiResponseDto(undefined, {successStatusCode: 201})
    @Patch()
    influencerUpdateOngoingCampaign(
        @Req() request: AuthenticatedRequest,
        @Body() body: InfluencerUpdatePromoReqBodyDto,
    ): Promise<{balance: number}> {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        return this.promosService.updateOngoingCampaign({...body, influencerId: request.user._id});
    }
}
