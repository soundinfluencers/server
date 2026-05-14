import {Controller, Get, Param, Patch, Query} from "@nestjs/common";
import {Auth} from "../../../common/decorators/auth.decorator";
import {Roles} from "../../../common/decorators/roles.decorator";
import {Role} from "../../../common/types/user.types";
import {ApiOperation, ApiParam, ApiQuery, ApiTags} from "@nestjs/swagger";
import {AdminRequestsService} from "../services/requests/admin-requests.service";
import {ParseObjectIdPipe} from "../../../common/pipes/parse-oid.pipe";
import {
    AdminRequestResponseAction,
    RequestForAdminType
} from "../../../common/types/request-for-admin/request-for-admin.types";
import {ApiResponseDto} from "../../../common/decorators/api/response/api-response.decorator";
import {OneOfQueryPipe} from "../../../common/pipes/one-of-query.pipe";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {AdminRequestsListResponseDto, AdminRequestsSearchResponseDto} from "../dto/requests/admin-requests.dto";
import {ApiResponseDtoOneOf} from "../../../common/decorators/api/response/api-response-one-of.decorator";

@Auth()
@Roles(Role.admin)
@ApiTags('admin/requests')
@Controller('admin/requests')
export class AdminRequestsController {
    constructor(private readonly adminService: AdminRequestsService) {
    }

    @ApiOperation({summary: "Fetch paginated requests list or search them"})
    @ApiResponseDtoOneOf([AdminRequestsListResponseDto, AdminRequestsSearchResponseDto])
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
    getRequests(
        @Query(
            new OneOfQueryPipe([
                {
                    dto: SearchQueryDto,
                    match: (value) => value?.search !== undefined,
                },
                {
                    dto: PaginationQueryDto,
                    match: () => true,
                }
            ]),
        )
        query: SearchQueryDto | PaginationQueryDto,
    ): Promise<AdminRequestsListResponseDto | AdminRequestsSearchResponseDto> {
        if ('search' in query && query.search?.trim()) {
            return this.adminService.searchRequests(query);
        }

        return this.adminService.getRequestsList(query);
    }

    @ApiOperation({summary: "Returns detailed request's information"})
    @ApiResponseDto()
    @ApiParam({
        name: 'requestId',
        type: String,
        required: true
    })
    @ApiParam({
        name: 'requestType',
        type: String,
        enum: RequestForAdminType,
        required: true
    })
    @Get(':requestId/:requestType')
    getRequestDetails(@Param('requestId', new ParseObjectIdPipe()) requestId: string, @Param('requestType') requestType: RequestForAdminType) {
        return this.adminService.getRequestDetails(requestId, requestType);
    }


    @ApiOperation({summary: "Responds to request. Finds request by id, defines types and updates it"})
    @ApiResponseDto()
    @ApiParam({
        name: 'requestId',
        type: String,
        required: true
    })
    @ApiParam({
        name: 'response',
        type: String,
        enum: AdminRequestResponseAction,
        required: true
    })
    @Patch(':requestId/:response')
    respondToRequest(
        @Param('requestId', new ParseObjectIdPipe()) requestId: string,
        @Param('response') response: AdminRequestResponseAction
    ): Promise<void> {
        return this.adminService.respond(requestId, response);
    }
}