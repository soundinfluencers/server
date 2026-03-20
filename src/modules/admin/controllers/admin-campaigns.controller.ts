import {Controller, Get, Post, Query} from '@nestjs/common';
import {ApiExcludeController, ApiExcludeEndpoint, ApiOperation, ApiTags} from "@nestjs/swagger";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {Roles} from "../../../common/decorators/roles.decorator";
import {Role} from "../../../common/types/user.types";
import {Auth} from "../../../common/decorators/auth.decorator";
import {AdminClientsListResponseDto, AdminClientsSearchResponseDto} from "../dto/clients/admin-clients.dto";
import {ApiResponseDto} from "../../../common/decorators/api/response/api-response.decorator";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {AdminCampaignsService} from "../services/admin-campaigns.service";

@ApiExcludeController()
@Auth()
@Roles(Role.admin)
@ApiTags('admin/campaigns')
@Controller('admin/campaigns')
export class AdminCampaignsController {
    constructor(private readonly adminService: AdminCampaignsService) {
    }

    @ApiOperation({summary: 'Return paginated campaigns list'})
    @ApiResponseDto(AdminClientsListResponseDto)
    @Get()
    getCampaignsList(
        @Query() query: PaginationQueryDto
    ): Promise<AdminClientsListResponseDto> {
        return this.adminService.getCampaignsList(query);
    }

    @ApiOperation({summary: 'Search campaigns'})
    @ApiResponseDto(AdminClientsSearchResponseDto)
    @Post()
    searchCampaigns(
        @Query() query: SearchQueryDto
    ): Promise<AdminClientsSearchResponseDto> {
        return this.adminService.searchCampaigns(query);
    }
}
