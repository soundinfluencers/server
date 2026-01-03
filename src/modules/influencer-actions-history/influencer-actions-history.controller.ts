import {
    Body,
    Controller,
    Get,
    Param,
    Patch, Query,
    UsePipes,
    ValidationPipe
} from '@nestjs/common';
import {InfluencerActionsHistoryService} from "./influencer-actions-history.service";
import {CheckIfInCampaignDto} from "./dto/check-if-in-campaign.dto";
import {ApiQuery, ApiTags} from "@nestjs/swagger";
import {Auth} from "../../common/decorators/auth.decorator";
import {Roles} from "../../common/decorators/roles.decorator";
import {Role} from "../../common/types/auth.types";
import {AllHistoriesResponseDto, GetAllHistoriesQueryDto, OneHistoryResponseDto} from "./dto/get-history.dto";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";

@ApiTags('influencer-actions-history')
@Controller('influencer-actions-history')
export class InfluencerActionsHistoryController {
    constructor(private readonly influencerActionsHistoryService: InfluencerActionsHistoryService) {
    }

    @Auth()
    @Roles(Role.admin)
    @ApiResponseDto(AllHistoriesResponseDto)
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

    @Auth()
    @Roles(Role.admin)
    @ApiResponseDto(OneHistoryResponseDto)
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
