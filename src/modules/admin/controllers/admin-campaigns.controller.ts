import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseEnumPipe,
    Patch,
    Post,
    Query,
    UploadedFile,
    UseInterceptors
} from '@nestjs/common';
import {ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiTags} from "@nestjs/swagger";
import {Roles} from "../../../common/decorators/roles.decorator";
import {Role} from "../../../common/types/user.types";
import {Auth} from "../../../common/decorators/auth.decorator";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {AdminCampaignsService} from "../services/admin-campaigns.service";
import {
    AdminCampaignDetailsDto,
    AdminCampaignSearchResponseDto,
    AdminCampaignsListResponseDto,
    AdminCampaignsListStatusEnum,
    GetAdminCampaignsListQueryDto
} from "../dto/campaigns/admin-campaigns.dto";
import {ApiResponseDtoOneOf} from "../../../common/decorators/api/response/api-response-one-of.decorator";
import {OneOfQueryPipe} from "../../../common/pipes/one-of-query.pipe";
import {ApiResponseDto} from "../../../common/decorators/api/response/api-response.decorator";
import {UpdateAdminMetaCampaignDto, UpdatedAdminMetaCampaignDto} from "../dto/campaigns/admin-update-campaign.dto";
import {ParseObjectIdPipe} from "../../../common/pipes/parse-oid.pipe";
import {UpdateCampaignDto} from "../../campaigns/dto/update-campaign.dto";
import {FileInterceptor} from "@nestjs/platform-express";

@Auth()
@Roles(Role.admin)
@ApiTags('admin/campaigns')
@Controller('admin/campaigns')
export class AdminCampaignsController {
    constructor(private readonly adminService: AdminCampaignsService) {
    }

    @ApiOperation({summary: "Fetch paginated campaigns list or search them"})
    @ApiResponseDtoOneOf([AdminCampaignsListResponseDto, AdminCampaignSearchResponseDto])
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
    @ApiQuery({
        name: 'status',
        required: false,
        type: String,
        enum: AdminCampaignsListStatusEnum,
        description: 'Status of campaign',
    })
    @Get()
    getCampaigns(
        @Query(
            new OneOfQueryPipe([
                {
                    dto: SearchQueryDto,
                    match: (value) => value?.search !== undefined,
                },
                {
                    dto: GetAdminCampaignsListQueryDto,
                    match: () => true,
                },
            ]),
        ) query: SearchQueryDto | GetAdminCampaignsListQueryDto,
    ): Promise<AdminCampaignsListResponseDto | AdminCampaignSearchResponseDto> {
        if ('search' in query && query.search?.trim()) {
            return this.adminService.searchCampaigns(query);
        }

        return this.adminService.getCampaignsList(query);
    }


    @ApiOperation({summary: "Update campaign's meta field."})
    @ApiResponseDto(UpdatedAdminMetaCampaignDto)
    @ApiParam({
        name: "status",
        type: String,
        required: true,
        enum: AdminCampaignsListStatusEnum,
    })
    @ApiParam({
        name: "campaignId",
        type: String,
        required: true,
    })
    @Patch(':status/:campaignId/meta')
    updateAdminMeta(
        @Body() data: UpdateAdminMetaCampaignDto,
        @Param(
            'status',
            new ParseEnumPipe(AdminCampaignsListStatusEnum)
        ) status: AdminCampaignsListStatusEnum,
        @Param(
            'campaignId',
            new ParseObjectIdPipe()
        ) campaignId: string,
    ): Promise<UpdatedAdminMetaCampaignDto> {
        return this.adminService.updateMeta(data, status, campaignId);
    }

    @ApiOperation({summary: "Deletes campaign"})
    @ApiResponseDto()
    @ApiParam({
        name: "status",
        type: String,
        required: true,
        enum: AdminCampaignsListStatusEnum,
    })
    @ApiParam({
        name: 'campaignId',
        type: String,
        required: true,
    })
    @Delete(':status/:campaignId')
    deleteCampaign(
        @Param(
            'status',
            new ParseEnumPipe(AdminCampaignsListStatusEnum)
        ) status: AdminCampaignsListStatusEnum,
        @Param(
            'campaignId',
            new ParseObjectIdPipe()
        ) campaignId: string
    ) {
        return this.adminService.deleteCampaign(status, campaignId);
    }

    @ApiOperation({summary: "Fetch campaign details"})
    @ApiResponseDto(AdminCampaignDetailsDto)
    @ApiParam({
        name: "status",
        type: String,
        required: true,
        enum: AdminCampaignsListStatusEnum,
    })
    @ApiParam({
        name: 'campaignId',
        type: String,
        required: true,
    })
    @ApiQuery({
        name: 'optionIndex',
        required: false,
        type: Number,
        description: 'Option index for proposal campaigns (0-based)',
    })
    @Get(':status/:campaignId')
    getDetailedCampaign(
        @Param(
            'status',
            new ParseEnumPipe(AdminCampaignsListStatusEnum)
        ) status: AdminCampaignsListStatusEnum,
        @Param(
            'campaignId',
            new ParseObjectIdPipe()
        ) campaignId: string,
        @Query('optionIndex') optionIndex?: number,
    ): Promise<AdminCampaignDetailsDto> {
        if (status === AdminCampaignsListStatusEnum.proposal && optionIndex === undefined) {
            throw new BadRequestException("For fetching proposal campaign, you must provide optionIndex");
        }

        return this.adminService.getDetailedCampaign(status, campaignId, optionIndex);
    }

    @ApiOperation({summary: "Updates campaign"})
    @ApiResponseDto(AdminCampaignDetailsDto)
    @ApiParam({
        name: "status",
        type: String,
        required: true,
        enum: AdminCampaignsListStatusEnum,
    })
    @ApiParam({
        name: 'campaignId',
        type: String,
        required: true,
    })
    @ApiQuery({
        name: 'optionIndex',
        required: false,
        type: Number,
        description: 'Option index for proposal campaigns (0-based)',
    })
    @Patch(':status/:campaignId')
    updateCampaign(
        @Param(
            'status',
            new ParseEnumPipe(AdminCampaignsListStatusEnum)
        ) status: AdminCampaignsListStatusEnum,
        @Param(
            'campaignId',
            new ParseObjectIdPipe()
        ) campaignId: string,
        @Body() data: UpdateCampaignDto,
        @Query('optionIndex') optionIndex?: number,
    ): Promise<AdminCampaignDetailsDto> {
        return this.adminService.updateCampaign(status, campaignId, data, optionIndex);
    }

    @ApiOperation({summary: "Import xlsx file with new proposal campaign"})
    @ApiResponseDto()
    @ApiConsumes("multipart/form-data")
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
    @Post('/xlsx')
    importXlsx(@UploadedFile() file: Express.Multer.File): Promise<void> {
        return this.adminService.importXlsx(file);
    }
}
