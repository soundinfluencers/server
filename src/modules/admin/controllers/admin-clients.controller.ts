import {Controller, Get, Query} from '@nestjs/common';
import {AdminClientsService} from '../services/admin-clients.service';
import {ApiOperation, ApiTags} from "@nestjs/swagger";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {Roles} from "../../../common/decorators/roles.decorator";
import {Role} from "../../../common/types/user.types";
import {Auth} from "../../../common/decorators/auth.decorator";
import {AdminClientsListResponseDto} from "../dto/clients/admin-clients.dto";
import {ApiResponseDto} from "../../../common/decorators/api/response/api-response.decorator";

@Auth()
@Roles(Role.admin)
@ApiTags('admin/clients')
@Controller('admin/clients')
export class AdminClientsController {
    constructor(private readonly adminService: AdminClientsService) {
    }

    @ApiOperation({summary: 'Return paginated clients list'})
    @ApiResponseDto(AdminClientsListResponseDto)
    @Get()
    getClientsList(
        @Query() query: PaginationQueryDto
    ): Promise<AdminClientsListResponseDto> {
        return this.adminService.getClientsList(query);
    }
}
