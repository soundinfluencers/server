import {BadRequestException, Controller, Get, Param, ParseIntPipe, Patch, Query} from '@nestjs/common';
import {Roles} from "../../../common/decorators/roles.decorator";
import {Role} from "../../../common/types/user.types";
import {Auth} from "../../../common/decorators/auth.decorator";
import {AdminActionsHistoryService, IAdminActionsHistory} from "../services/admin-actions-history.service";
import {ApiOperation, ApiParam, ApiQuery, ApiTags} from "@nestjs/swagger";
import {ApiResponseDto} from "../../../common/decorators/api/response/api-response.decorator";
import {OneHistoryResponseDto} from "../../influencer-actions-history/dto/get-history.dto";
import {AdminInfActionsHistoryDto, AdminInfActionsHistoryLatestDto} from "../dto/histories/admin-inf-history.dto";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";

@Auth()
@Roles(Role.admin)
@ApiTags('admin/actions-history')
@Controller('admin/actions-history')
export class AdminActionsHistoryController implements IAdminActionsHistory {
    constructor(private readonly adminService: AdminActionsHistoryService) {
    }

    @ApiOperation({summary: "Get 10 last actions history updates"})
    @ApiResponseDto(AdminInfActionsHistoryLatestDto, {isArray: true})
    @ApiQuery({
        name: 'limit',
        type: Number,
        required: false
    })
    @Get('/latest')
    getLatestUpdates(@Query('limit') limit?: number): Promise<AdminInfActionsHistoryLatestDto[]> {
        return this.adminService.getLatestUpdates(limit ? Number(limit) : undefined);
    }

    @ApiResponseDto(OneHistoryResponseDto)
    @ApiOperation({summary: "Returns history for one influencer"})
    @ApiParam({
        name: 'influencerId',
        required: true,
        type: 'string'
    })
    @Get(':influencerId')
    getInfluencerHistory(@Param('influencerId') influencerId: string, @Query() query: PaginationQueryDto): Promise<{
        history: AdminInfActionsHistoryDto;
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        return this.adminService.getInfluencerHistory(influencerId, query);
    }

    @ApiResponseDto(Boolean)
    @ApiOperation({summary: "Check if social account still in campaign"})
    @ApiParam({
        name: 'influencerId',
        required: true,
        type: 'string'
    })
    @ApiParam({
        name: 'actionId',
        required: true,
        type: 'string'
    })
    @Patch(':influencerId/campaigns/:actionId/sync')
    checkIfAccountStillInCampaign(
        @Param('influencerId') influencerId: string,
        @Param('actionId') actionId: string
    ): Promise<boolean> {
        if (!influencerId) throw new BadRequestException('Invalid influencerId');
        if (!actionId) throw new BadRequestException('Invalid actionId');

        return this.adminService.checkIfAccountStillInCampaign(influencerId, actionId);
    }
}
