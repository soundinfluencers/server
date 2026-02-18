import {
    Body,
    Controller,
    Get,
    Param,
    Patch, Query, Req,
    UsePipes,
    ValidationPipe
} from '@nestjs/common';
import {InfluencerActionsHistoryService} from "./influencer-actions-history.service";
import {CheckIfInCampaignDto} from "./dto/check-if-in-campaign.dto";
import {ApiExcludeEndpoint, ApiOperation, ApiParam, ApiQuery, ApiTags} from "@nestjs/swagger";
import {Auth} from "../../common/decorators/auth.decorator";
import {Roles} from "../../common/decorators/roles.decorator";
import {AuthenticatedRequest, Role} from "../../common/types/user.types";
import {
    AllHistoriesResponseDto, CurrentUserCampaignHistoryDto,
    GetAllHistoriesQueryDto,
    GetCurrentUserCampaignsHistoryQueryDto, HistoryCampaignItemForProcessedHistory,
    OneHistoryResponseDto
} from "./dto/get-history.dto";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";

@ApiTags('influencer-actions-history')
@Controller('influencer-actions-history')
export class InfluencerActionsHistoryController {
    constructor(private readonly influencerActionsHistoryService: InfluencerActionsHistoryService) {
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiResponseDto(CurrentUserCampaignHistoryDto)
    @ApiOperation({summary: "Returns current influencer's campaigns activity history"})
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
    @Get('/me')
    async getMyHistory(@Req() req: AuthenticatedRequest, @Query() query: GetCurrentUserCampaignsHistoryQueryDto): Promise<CurrentUserCampaignHistoryDto> {
        const history = await this.influencerActionsHistoryService.getCurrentUserCampaignHistory({...query, influencerId: req.user._id});
        return ({history});
    }

    @ApiExcludeEndpoint()
    @Auth()
    @Roles(Role.admin)
    @ApiResponseDto(AllHistoriesResponseDto)
    @ApiOperation({summary: "Returns all histories (with limit and page)"})
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
    @Get()
    async getAllHistories(@Query() query: GetAllHistoriesQueryDto) {
        return this.influencerActionsHistoryService.getAllHistories(query);
    }

    @ApiExcludeEndpoint()
    @Auth()
    @Roles(Role.admin)
    @ApiResponseDto(OneHistoryResponseDto)
    @ApiOperation({summary: "Returns history for one influencer"})
    @ApiParam({
        name: 'influencerId',
        required: true,
        type: 'string'
    })
    @Get(':influencerId')
    getOneHistory(@Param('influencerId') influencerId: string): Promise<OneHistoryResponseDto> {
        return this.influencerActionsHistoryService.getActionsHistoryForInfluencer(influencerId);
    }

    //
    // // TODO
    // @Auth()
    // @Roles(Role.admin)
    // @Get('last-updates')
    // getLastUpdates() {
    //     return this.influencerActionsHistoryService.getLastUpdates();
    // }
    //
    // // TODO
    // @Auth()
    // @Roles(Role.admin)
    // @Patch('patch/check-if-still-in-campaign')
    // @UsePipes(new ValidationPipe({whitelist: true, forbidNonWhitelisted: true, transform: true}))
    // checkIfStillInCampaign(@Body() data: CheckIfInCampaignDto) {
    //     return this.influencerActionsHistoryService.checkIfStillInCampaign(data);
    // }
}
