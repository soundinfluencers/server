import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UnauthorizedException,
    UploadedFile,
    UseInterceptors
} from "@nestjs/common";
import {AdminInfluencersService, IAdminInfluencersService} from "../services/admin-influencers.service";
import {Auth} from "../../../common/decorators/auth.decorator";
import {AuthenticatedRequest, Role} from "../../../common/types/user.types";
import {Roles} from "../../../common/decorators/roles.decorator";
import {ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiTags} from "@nestjs/swagger";
import {SocialMediaEnum} from "../../../common/types/social-media.types";

import {AdminInfluencersListDto, AdminSocialAccountForListDto} from "../dto/influencers/admin-influencers.dto";
import {AdminInfluencersQueryDto} from "../dto/influencers/admin-influencers-query.dto";
import {ApiResponseDto} from "../../../common/decorators/api/response/api-response.decorator";
import {FileInterceptor} from "@nestjs/platform-express";
import {SocialAccountDetailsDto} from "../../profile/dto/influencer/get-profile.dto";
import {InfluencerUpdatedPersonalDto, UpdateSocialAccountDto} from "../../profile/dto/influencer/update-influencer.dto";
import {
    AdminUpdateInfluencerPersonalDto,
    AdminUpdateSocialAccountDto
} from "../dto/influencers/admin-update-influencer.dto";
import {ApiResponseDtoOneOf} from "../../../common/decorators/api/response/api-response-one-of.decorator";

@Auth()
@Roles(Role.admin)
@ApiTags('admin/influencers')
@Controller('admin/influencers')
export class AdminInfluencersController implements IAdminInfluencersService {
    constructor(private readonly adminService: AdminInfluencersService) {}

    @ApiOperation({ summary: 'Get paginated influencers list with optional platform filter and search' })
    @ApiResponseDto(AdminInfluencersListDto)
    @Get()
    getPaginated(
        @Query() query: AdminInfluencersQueryDto
    ): Promise<AdminInfluencersListDto> {
        return this.adminService.getPaginated(query);
    }

    @ApiOperation({summary: "Updates influencer's social account"})
    @ApiResponseDto(AdminSocialAccountForListDto)
    @Patch('social-account')
    updateSocialAccount(@Body() data: AdminUpdateSocialAccountDto): Promise<AdminSocialAccountForListDto> {
        return this.adminService.updateSocialAccount(data);
    }

    @ApiOperation({summary: `Updates influencer's personal info and: \n1) Returns InfluencerUpdatedPersonalDto if accountId IS NOT provided; \n2) Returns AdminSocialAccountForListDto if accountId IS provided`})
    @ApiResponseDtoOneOf([AdminSocialAccountForListDto, InfluencerUpdatedPersonalDto])
    @ApiParam({
        name: 'influencerId',
        type: String,
        required: true
    })
    @ApiQuery({
        name: 'accountId',
        type: String,
        required: false
    })
    @Patch(':influencerId')
    updatePersonalInfo(
        @Param('influencerId') influencerId: string,
        @Body() data: AdminUpdateInfluencerPersonalDto,
        @Query('accountId') accountId?: string
    ): Promise<InfluencerUpdatedPersonalDto | AdminSocialAccountForListDto> {
        return this.adminService.updatePersonalInfo(influencerId, data, accountId);
    }

    @ApiOperation({ summary: "Import xlsx file with new social accounts" })
    @ApiResponseDto()
    @ApiConsumes("multipart/form-data")
    @ApiParam({
        name: "socialMedia",
        type: String,
        enum: SocialMediaEnum,
        required: true,
    })
    @ApiBody({
        schema: {
            type: "object",
            properties: {
                file: {
                    type: "string",
                    format: "binary",
                },
            },
            required: ["file"],
        },
    })
    @UseInterceptors(FileInterceptor("file"))
    @Post(":socialMedia/xlsx")
    importXlsxSocialAccounts(
        @Param("socialMedia") socialMedia: SocialMediaEnum,
        @UploadedFile() file: Express.Multer.File,
    ): Promise<void> {
        return this.adminService.importXlsxSocialAccounts(socialMedia, file);
    }
}