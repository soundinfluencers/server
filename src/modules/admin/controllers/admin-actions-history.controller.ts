import {BadRequestException, Controller, Get, Param, Patch, Query} from '@nestjs/common';
import {Roles} from "../../../common/decorators/roles.decorator";
import {Role} from "../../../common/types/user.types";
import {Auth} from "../../../common/decorators/auth.decorator";
import {AdminActionsHistoryService, IAdminActionsHistory} from "../services/admin-actions-history.service";
import {ApiOperation, ApiParam, ApiTags} from "@nestjs/swagger";
import {ApiResponseDto} from "../../../common/decorators/api/response/api-response.decorator";
import {OneHistoryResponseDto} from "../../influencer-actions-history/dto/get-history.dto";
import {AdminInfActionsHistoryDto} from "../dto/histories/admin-inf-history.dto";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";

@Auth()
@Roles(Role.admin)
@ApiTags('admin/actions-history')
@Controller('admin/actions-history')
export class AdminActionsHistoryController implements IAdminActionsHistory {
    constructor(private readonly adminService: AdminActionsHistoryService) {
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
        name: 'campaignId',
        required: true,
        type: 'string'
    })
    @ApiParam({
        name: 'accountId',
        required: true,
        type: 'string'
    })
    @Patch(':campaignId/accounts/:accountId/sync')
    checkIfAccountStillInCampaign(@Param('campaignId') campaignId: string, @Param('accountId') accountId: string): Promise<boolean> {
        if (!campaignId) throw new BadRequestException('Invalid campaignId');
        if (!accountId) throw new BadRequestException('Invalid accountId');

        return this.adminService.checkIfAccountStillInCampaign(campaignId, accountId);
    }
}
