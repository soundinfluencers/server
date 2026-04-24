import {Controller, Get, Injectable, Query} from "@nestjs/common";
import {Auth} from "../../../common/decorators/auth.decorator";
import {Roles} from "../../../common/decorators/roles.decorator";
import {Role} from "../../../common/types/user.types";
import {ApiOperation, ApiTags} from "@nestjs/swagger";
import {AdminPaymentsHistoryService} from "../services/admin-payments-history.service";
import {
    AdminPaymentsHistoryMatrixDto,
    GetAdminPaymentsHistoryMatrixQuery
} from "../dto/payments-history/admin-payments-history.dto";
import {ApiResponseDto} from "../../../common/decorators/api/response/api-response.decorator";

@Auth()
@Roles(Role.admin)
@ApiTags('admin/payments-history')
@Controller('admin/payments-history')
@Injectable()
export class AdminPaymentsHistoryController {
    constructor(private readonly adminService: AdminPaymentsHistoryService) {
    }

    @ApiOperation({ summary: "Get admin payments history matrix" })
    @ApiResponseDto(AdminPaymentsHistoryMatrixDto)
    @Get()
    getMatrix(@Query() query: GetAdminPaymentsHistoryMatrixQuery): Promise<AdminPaymentsHistoryMatrixDto> {
        return this.adminService.getMatrix(query);
    }
}