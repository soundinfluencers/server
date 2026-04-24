import {Auth} from "../../../common/decorators/auth.decorator";
import {Roles} from "../../../common/decorators/roles.decorator";
import {AuthenticatedRequest, Role} from "../../../common/types/user.types";
import {ApiOperation, ApiParam, ApiQuery, ApiTags} from "@nestjs/swagger";
import {BadRequestException, Controller, Get, Param, Patch, Query, Req} from "@nestjs/common";
import {AdminClientInvoicesService} from "../services/invoices/admin-client-invoices.service";
import {ApiResponseDtoOneOf} from "../../../common/decorators/api/response/api-response-one-of.decorator";
import {OneOfQueryPipe} from "../../../common/pipes/one-of-query.pipe";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {
    AdminClientInvoicesListResponseDto,
    AdminClientInvoicesSearchResponseDto,
    AdminInfluencerInvoicesListResponseDto, AdminInfluencerInvoicesSearchResponseDto
} from "../dto/invoices/admin-invoices.dto";
import {AdminInfluencerInvoicesService} from "../services/invoices/admin-influencer-invoices.service";
import {ApiResponseDto} from "../../../common/decorators/api/response/api-response.decorator";
import {ParseObjectIdPipe} from "../../../common/pipes/parse-oid.pipe";

@Auth()
@Roles(Role.admin)
@ApiTags('admin/invoices')
@Controller('admin/invoices')
export class AdminInvoicesController {
    constructor(
        private readonly clientInvoiceService: AdminClientInvoicesService,
        private readonly influencerInvoiceService: AdminInfluencerInvoicesService,
    ) {
    }

    // Orchestrator for getting service based on role
    private getService(role: Role) {
        if (!role) throw new BadRequestException("Invalid role");

        switch (role) {
            case Role.admin:
                throw new BadRequestException("Invalid role");
            case Role.influencer:
                return this.influencerInvoiceService;
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
    ):
        Promise<AdminInfluencerInvoicesSearchResponseDto> |
        Promise<AdminClientInvoicesSearchResponseDto> |
        Promise<AdminClientInvoicesListResponseDto> |
        Promise<AdminInfluencerInvoicesListResponseDto>
    {
        const service = this.getService(role);

        if ('search' in query && query.search?.trim()) {
            return service.search(query);
        }

        return service.getList(query);
    }

    @ApiResponseDto()
    @ApiParam({
        name: 'invoiceId',
        type: String,
        required: true
    })
    @Patch('mark-paid/:invoiceId')
    markPaid(@Param('invoiceId', new ParseObjectIdPipe()) invoiceId: string, @Req() request: AuthenticatedRequest): Promise<void> {
        return this.influencerInvoiceService.markPaid(invoiceId, request.user._id);
    }
}