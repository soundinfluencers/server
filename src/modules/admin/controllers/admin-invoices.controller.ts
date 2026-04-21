import {Auth} from "../../../common/decorators/auth.decorator";
import {Roles} from "../../../common/decorators/roles.decorator";
import {Role} from "../../../common/types/user.types";
import {ApiOperation, ApiParam, ApiQuery, ApiTags} from "@nestjs/swagger";
import {BadRequestException, Controller, Get, Param, Query} from "@nestjs/common";
import {AdminClientInvoicesService} from "../services/invoices/admin-client-invoices.service";
import {ApiResponseDtoOneOf} from "../../../common/decorators/api/response/api-response-one-of.decorator";
import {OneOfQueryPipe} from "../../../common/pipes/one-of-query.pipe";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {
    AdminClientInvoicesListResponseDto,
    AdminClientInvoicesSearchResponseDto
} from "../dto/invoices/admin-invoices.dto";

@Auth()
@Roles(Role.admin)
@ApiTags('admin/invoices')
@Controller('admin/invoices')
export class AdminInvoicesController {
    constructor(private readonly clientInvoiceService: AdminClientInvoicesService) {
    }

    // Orchestrator for getting service based on role
    private getService(role: Role) {
        if (!role) throw new BadRequestException("Invalid role");

        switch (role) {
            case Role.admin:
                throw new BadRequestException("Invalid role");
            case Role.influencer:
                throw new BadRequestException("Currently unsupported role");
            case Role.client:
                return this.clientInvoiceService;
            default:
                throw new BadRequestException("Invalid role");
        }
    }

    @ApiOperation({summary: "Fetch paginated invoices list or search them"})
    @ApiResponseDtoOneOf([AdminClientInvoicesListResponseDto, AdminClientInvoicesSearchResponseDto])
    @ApiParam({
        name: 'role',
        type: String,
        enum: Role,
        required: true
    })
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
    @Get(':role')
    getClients(
        @Param('role') role: Role,
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
    ): Promise<AdminClientInvoicesListResponseDto | AdminClientInvoicesSearchResponseDto> {
        const service = this.getService(role);

        if ('search' in query && query.search?.trim()) {
            return service.search(query);
        }

        return service.getList(query);
    }
}