import {Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors} from "@nestjs/common";
import {AdminInfluencersService, IAdminInfluencersService} from "../services/admin-influencers.service";
import {Auth} from "../../../common/decorators/auth.decorator";
import {Role} from "../../../common/types/user.types";
import {Roles} from "../../../common/decorators/roles.decorator";
import {ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags} from "@nestjs/swagger";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {AdminInfluencersListDto, AdminSocialAccountsSearchResponseDto} from "../dto/influencers/admin-influencers.dto";
import {ApiResponseDto} from "../../../common/decorators/api/response/api-response.decorator";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {FileInterceptor} from "@nestjs/platform-express";

@Auth()
@Roles(Role.admin)
@ApiTags('admin/influencers')
@Controller('admin/influencers')
export class AdminInfluencersController implements IAdminInfluencersService {
    constructor(private readonly adminService: AdminInfluencersService) {}

    @ApiOperation({ summary: 'Get paginated influencers list with social media filter' })
    @ApiResponseDto(AdminInfluencersListDto)
    @ApiParam({
        name: 'socialMedia',
        type: String,
        enum: SocialMediaEnum,
        required: true,
    })
    @Get(':socialMedia')
    getInfluencersList(
        @Param('socialMedia') socialMedia: SocialMediaEnum,
        @Query() query: PaginationQueryDto
    ): Promise<AdminInfluencersListDto> {
        return this.adminService.getInfluencersList(socialMedia, query);
    }

    @ApiOperation({ summary: "Search social accounts" })
    @ApiResponseDto()
    @Post()
    searchSocialAccounts(
        @Query() query: SearchQueryDto
    ): Promise<AdminSocialAccountsSearchResponseDto> {
        return this.adminService.searchSocialAccounts(query);
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