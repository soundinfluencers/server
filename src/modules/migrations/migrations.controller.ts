import {ApiOperation, ApiTags} from "@nestjs/swagger";
import {Body, Controller, Patch} from "@nestjs/common";
import {MigrationsService} from "./migrations.service";
import {MigrateAccountDto} from "./dto/migrate-account.dto";
import {Auth} from "../../common/decorators/auth.decorator";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";
import {Roles} from "../../common/decorators/roles.decorator";
import {Role} from "../../common/types/auth.types";
import {MigrateCampaignsDto} from "./dto/migrate-campaigns.dto";

@ApiTags('migrations')
@Controller('migrations')
export class MigrationsController {
    constructor(private readonly migrationsService: MigrationsService) {}

    @Auth()
    @Roles(Role.admin)
    @ApiOperation({ summary: "(ADMIN) Migrate social account (second account id) to influencer's object of first account" })
    @ApiResponseDto(undefined, { successStatusCode: 201 })
    @Patch('account')
    migrateSocialAccount(@Body() data: MigrateAccountDto) {
        return this.migrationsService.migrateSocialAccountOrchestrator(data);
    }

    @Auth()
    @Roles(Role.admin)
    @ApiOperation({ summary: '(ADMIN) Migrate completed campaigns schema to latest format' })
    @ApiResponseDto(undefined, { successStatusCode: 201 })
    @Patch('completed-campaigns')
    migrateCompletedCampaigns(@Body() data: MigrateCampaignsDto) {
        return this.migrationsService.migrateCampaigns(data);
    }

    @Auth()
    @Roles(Role.admin)
    @ApiOperation({ summary: '(ADMIN) Migrate influencers schema to latest format' })
    @ApiResponseDto(undefined, { successStatusCode: 201 })
    @Patch('influencers')
    migrateInfluencersSocialAccountsV2(@Body() data: MigrateCampaignsDto) {
        return this.migrationsService.migrateInfluencersSocialAccountsV2(data);
    }

    @Auth()
    @Roles(Role.admin)
    @ApiOperation({ summary: '(ADMIN) Migrate proposal campaigns to latest format'})
    @ApiResponseDto(undefined, { successStatusCode: 201 })
    @Patch('proposal-campaigns')
    migrateProposalCampaigns(@Body() data: MigrateCampaignsDto) {
        return this.migrationsService.migrateProposalCampaigns(data);
    }
}
