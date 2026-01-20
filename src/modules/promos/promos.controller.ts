import {
    Body,
    Controller,
    Get,
    Patch,
    Query,
    Req,
    UnauthorizedException,
} from '@nestjs/common';
import {PromosService} from './promos.service';
import {ApiOperation, ApiQuery, ApiTags} from '@nestjs/swagger';
import {
    InfluencerCompletedPromoDto,
    InfluencerCompletedPromosDto,
    InfluencerDashboardPromosDto,
    InfluencerDetailedPromoDto,
    InfluencerGetCompletedPromosQueryDto,
    InfluencerGetDashboardPromosQueryDto,
    InfluencerGetPastPromoQueryDto,
    InfluencerNewPromoRequestsDto, InfluencerUpdatePromoReqBodyDto,
    InfluencerUpdatePromoResponseUpdateDto,
} from "./dto/influencer-get-promos.dto";
import {AuthenticatedRequest, Role} from "../../common/types/auth.types";
import {Auth} from "../../common/decorators/auth.decorator";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";
import {Roles} from "../../common/decorators/roles.decorator";
import {InfluencerDashboardPromoStatus} from "../../common/types/influencer/promo.types";

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
        const promos = await this.promosService.influencerGetNewPromos(request.user._id);
        return ({promos});
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: `Returns influencer's promos for dashboard`})
    @ApiResponseDto(InfluencerDashboardPromosDto)
    @ApiQuery({
        name: 'status',
        required: false,
        enum: InfluencerDashboardPromoStatus,
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
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        const promos = await this.promosService.influencerGetDashboardPromos({...query, influencerId: request.user._id});
        return ({promos});
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: `Returns influencer's detailed completed promos`})
    @ApiResponseDto(InfluencerCompletedPromosDto)
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
    @Get('completed')
    async influencerGetCompletedPromos(@Req() request: AuthenticatedRequest, @Query() query: InfluencerGetCompletedPromosQueryDto): Promise<InfluencerCompletedPromosDto> {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        const promos = await this.promosService.influencerGetCompletedPromos({...query, influencerId: request.user._id});
        return ({promos});
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: "Returns influencer's completed promo"})
    @ApiQuery({name: 'campaignId', required: true})
    @ApiQuery({name: 'selectInfluencersId', required: true})
    @ApiResponseDto(InfluencerCompletedPromoDto)
    @Get('completed/:campaignId')
    influencerGetCompletedPromo(
        @Req() request: AuthenticatedRequest,
        @Query() query: InfluencerGetPastPromoQueryDto
    ): Promise<InfluencerCompletedPromoDto> {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        return this.promosService.influencerPastPromoOne({...query, influencerId: request.user._id});
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: "Returns influencer's ongoing promo"})
    @ApiQuery({name: 'campaignId', required: true})
    @ApiQuery({name: 'selectInfluencersId', required: true})
    @ApiResponseDto(InfluencerDetailedPromoDto)
    @Get('ongoing/:campaignId')
    influencerGetOngoingPromo(
        @Req() request: AuthenticatedRequest,
        @Query() args: {
            campaignId: string;
            selectInfluencersId: string;
        },
    ): Promise<InfluencerDetailedPromoDto> {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        return this.promosService.influencerGetOngoingPromo(
            request.user._id,
            args.campaignId,
            args.selectInfluencersId,
        );
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

        return this.promosService.influencerUpdateResponseNewCampaign(dataToUse);
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: "Update influencer's promo"})
    @ApiResponseDto(undefined, {successStatusCode: 201})
    @Patch('ongoing')
    influencerUpdateOngoingCampaign(
        @Req() request: AuthenticatedRequest,
        @Body() body: InfluencerUpdatePromoReqBodyDto,
    ) {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        return this.promosService.influencerUpdateOngoingCampaign({...body, influencerId: request.user._id});
    }
}
