import {Controller, Get, Post, Query} from '@nestjs/common';
import {AdminClientsService} from '../services/admin-clients.service';
import {ApiOperation, ApiQuery, ApiTags} from "@nestjs/swagger";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {Roles} from "../../../common/decorators/roles.decorator";
import {Role} from "../../../common/types/user.types";
import {Auth} from "../../../common/decorators/auth.decorator";
import {AdminClientsListResponseDto, AdminClientsSearchResponseDto} from "../dto/clients/admin-clients.dto";
import {ApiResponseDto} from "../../../common/decorators/api/response/api-response.decorator";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {OneOfQueryPipe} from "../../../common/pipes/one-of-query.pipe";

@Auth()
@Roles(Role.admin)
@ApiTags('admin/clients')
@Controller('admin/clients')
export class AdminClientsController {
    constructor(private readonly adminService: AdminClientsService) {
    }

    @ApiOperation({ summary: "Fetch paginated clients list or search them" })
    @ApiResponseDto(AdminClientsListResponseDto)
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
    @Get()
    getClients(
        @Query(
            new OneOfQueryPipe([
                {
                    dto: SearchQueryDto,
                    match: (value) => value?.search !== undefined,
                },
                {
                    dto: PaginationQueryDto,
                    match: () => true,
                },
            ]),
        )
        query: SearchQueryDto | PaginationQueryDto,
    ): Promise<AdminClientsListResponseDto | AdminClientsSearchResponseDto> {
        if ('search' in query && query.search?.trim()) {
            return this.adminService.searchClients(query);
        }

        return this.adminService.getClientsList(query);
    }
}
