import {ApiOperation, ApiTags} from "@nestjs/swagger";
import {Body, Controller, Patch} from "@nestjs/common";
import {MigrationsService} from "./migrations.service";
import {MigrateAccountDto} from "./dto/migrate-account.dto";
import {Auth} from "../../common/decorators/auth.decorator";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";
import {Roles} from "../../common/decorators/roles.decorator";
import {Role} from "../../common/types/auth.types";

@ApiTags('migrations')
@Controller('migrations')
export class MigrationsController {
    constructor(private readonly migrationsService: MigrationsService) {}

    // @Auth()
    // @Roles(Role.admin)
    @ApiOperation({ summary: "(ADMIN) Migrate social account (second account id) to influencer's object of first account" })
    @ApiResponseDto(undefined, { successStatusCode: 201 })
    @Patch('account')
    migrateSocialAccount(@Body() data: MigrateAccountDto) {
        return this.migrationsService.migrateSocialAccountOrchestrator(data);
    }
}

// {
//     "influencerId": "69523e10c9ebda34d0516132",
//     "socialAccountToMigrateId": "68baaaeb0efdab02cc5195b3",
//     "socialMediaOfAccount": "instagram"
// }