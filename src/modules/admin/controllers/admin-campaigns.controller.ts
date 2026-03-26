import {Controller, Get, Query} from '@nestjs/common';
import {ApiOperation, ApiQuery, ApiTags} from "@nestjs/swagger";
import {Roles} from "../../../common/decorators/roles.decorator";
import {Role} from "../../../common/types/user.types";
import {Auth} from "../../../common/decorators/auth.decorator";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {AdminCampaignsService} from "../services/admin-campaigns.service";
import {
    AdminCampaignSearchResponseDto,
    AdminCampaignsListResponseDto, AdminCampaignsListStatusEnum,
    GetAdminCampaignsListQueryDto
} from "../dto/campaigns/admin-campaigns.dto";
import {ApiResponseDtoOneOf} from "../../../common/decorators/api/response/api-response-one-of.decorator";
import {OneOfQueryPipe} from "../../../common/pipes/one-of-query.pipe";

@Auth()
@Roles(Role.admin)
@ApiTags('admin/campaigns')
@Controller('admin/campaigns')
export class AdminCampaignsController {
    constructor(private readonly adminService: AdminCampaignsService) {
    }

    @ApiOperation({ summary: "Fetch paginated campaigns list or search them" })
    @ApiResponseDtoOneOf([AdminCampaignsListResponseDto, AdminCampaignSearchResponseDto])
    @ApiQuery({
        name: 'search',
        required: false,
        type: String,
        description: 'Search string',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'Page number',
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Maximum number of items to return',
    })
    @ApiQuery({
        name: 'status',
        required: false,
        type: String,
        enum: AdminCampaignsListStatusEnum,
        description: 'Status of campaign',
    })
    @Get()
    getCampaigns(
        @Query(
            new OneOfQueryPipe([
                {
                    dto: SearchQueryDto,
                    match: (value) => value?.search !== undefined,
                },
                {
                    dto: GetAdminCampaignsListQueryDto,
                    match: () => true,
                },
            ]),
        ) query: SearchQueryDto | GetAdminCampaignsListQueryDto,
    ): Promise<AdminCampaignsListResponseDto | AdminCampaignSearchResponseDto> {
        if ('search' in query && query.search?.trim()) {
            return this.adminService.searchCampaigns(query);
        }

        return this.adminService.getCampaignsList(query);
    }
}
