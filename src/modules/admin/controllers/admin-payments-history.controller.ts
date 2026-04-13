import {Controller, Injectable} from "@nestjs/common";
import {Auth} from "../../../common/decorators/auth.decorator";
import {Roles} from "../../../common/decorators/roles.decorator";
import {Role} from "../../../common/types/user.types";
import {ApiTags} from "@nestjs/swagger";
import {AdminPaymentsHistoryService} from "../services/admin-payments-history.service";

@Auth()
@Roles(Role.admin)
@ApiTags('admin/payments-history')
@Controller('admin/payments-history')
@Injectable()
export class AdminPaymentsHistoryController {
    constructor(private readonly adminService: AdminPaymentsHistoryService) {
    }
}