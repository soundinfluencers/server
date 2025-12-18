import {
    Body,
    Controller,
    Get,
    Patch,
    Post,
    Put,
    Query,
    Req,
    UnauthorizedException,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import {PromosService} from './promos.service';
import {ApiOperation, ApiQuery, ApiTags} from '@nestjs/swagger';
import {FileInterceptor} from '@nestjs/platform-express';
import File from 'multer';
import {
    InfluencerGetOngoingOrPastPromoResDto,
    InfluencerGetOngoingOrPastPromosResDto,
    InfluencerGetPastPromoQueryDto,
    InfluencerGetPromoRequestsDto,
    InfluencerUpdatePromoReqQueryDto,
    InfluencerUpdatePromoResponseUpdateDto,
} from "./dto/influencer-get-promos.dto";
import {AuthenticatedRequest, Role} from "../../common/types/auth.types";
import {Auth} from "../../common/decorators/auth.decorator";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";
import {
    InfluencerPromo,
    InfluencerPromoClosedStatusEnum,
    InfluencerPromoClosedStatusType
} from "../../common/types/influencer/promo.types";
import {Roles} from "../../common/decorators/roles.decorator";

// TODO: add 403 forbidden for clients
@ApiTags('promos')
@Controller('promos')
export class PromosController {
    constructor(private readonly promosService: PromosService) {
    }

    // TODO: REMOVE TO FILES SERVICE
    @Post('uploadScreenshot')
    @ApiOperation({summary: 'Uploads screenshot - will be removed to files controller'})
    @ApiResponseDto()
    @UseInterceptors(FileInterceptor('file'))
    uploadFile(@UploadedFile() file: File) {
        return this.promosService.uploadDropBox(file);
    }

    // TODO: REMOVE TO FILES SERVICE
    @Get('check-upload-status')
    @ApiOperation({summary: 'Checks if screenshot uploaded - will be removed to files controller'})
    @ApiResponseDto()
    async checkUploadStatus(@Query('fileName') fileName: string): Promise<boolean> {
        return await this.promosService.checkUploadStatus(fileName);
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: 'Get influencer new promos requests'})
    @ApiResponseDto(InfluencerGetPromoRequestsDto)
    @Get('requests')
    influencerGetNewPromos(@Req() request: AuthenticatedRequest): Promise<InfluencerGetPromoRequestsDto> {
        return this.promosService.influencerGetNewPromos(request.user._id).then((promos) => ({promos}));
    }

    @Auth()
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
    @ApiOperation({summary: `Returns influencer's ongoing or completed promos`})
    @ApiResponseDto(InfluencerGetOngoingOrPastPromosResDto)
    @ApiQuery({
        name: 'status',
        required: false,
        enum: InfluencerPromoClosedStatusEnum,
    })
    @Get()
    async influencerGetOngoingOrPastPromos(@Req() request: AuthenticatedRequest, @Query() query: { status: InfluencerPromoClosedStatusType }): Promise<InfluencerGetOngoingOrPastPromosResDto> {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        const promos = await this.promosService.influencerGetOngoingOrPastPromos(request.user._id, query.status);
        return ({promos});
    }

    @Auth()
    @ApiOperation({summary: "Returns influencer's ongoing promo"})
    @ApiQuery({name: 'campaignId', required: true})
    @ApiQuery({name: 'selectInfluencersId', required: true})
    @ApiResponseDto(InfluencerGetOngoingOrPastPromoResDto)
    @Get('completed/:campaignId')
    influencerGetCompletedPromo(
        @Req() request: AuthenticatedRequest,
        @Query() query: InfluencerGetPastPromoQueryDto
    ): Promise<InfluencerPromo> {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        return this.promosService.influencerPastPromoOne({ ...query, influencerId: request.user._id });
    }

    @Auth()
    @ApiOperation({summary: "Returns influencer's ongoing promo"})
    @ApiQuery({name: 'campaignId', required: true})
    @ApiQuery({name: 'selectInfluencersId', required: true})
    @ApiResponseDto(InfluencerGetOngoingOrPastPromoResDto)
    @Get('ongoing/:campaignId')
    influencerGetOngoingPromo(
        @Req() request: AuthenticatedRequest,
        @Query() args: {
            campaignId: string;
            selectInfluencersId: string;
        },
    ) {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        return this.promosService.influencerGetOngoingPromo(
            request.user._id,
            args.campaignId,
            args.selectInfluencersId,
        );
    }

    @Auth()
    @ApiOperation({summary: "Update influencer's promo"})
    @ApiQuery({name: 'influencerId', required: true})
    @ApiQuery({name: 'socialNetworkUsername', required: true})
    @ApiQuery({name: 'campaignId', required: true})
    @ApiQuery({name: 'selectInfluencersId', required: true})
    @ApiResponseDto(undefined, { successStatusCode: 201 })
    @Put('ongoing/:campaignId')
    influencerUpdateOngoingCampaign(
        @Query()
        query: InfluencerUpdatePromoReqQueryDto,
        @Req() request: AuthenticatedRequest,
        @Body() body: any,
    ) {
        if (!request.user._id) throw new UnauthorizedException('Unauthorized');

        query.influencerId = request.user._id;

        return this.promosService.influencerUpdateOngoingCampaign(
            query,
            body,
        );
    }
}
