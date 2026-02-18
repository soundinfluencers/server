import {Body, Controller, Get, Patch, Query, Req, UnauthorizedException} from '@nestjs/common';
import {ReportsSizesService} from './reports-sizes.service';
import {ApiOperation, ApiQuery, ApiTags} from "@nestjs/swagger";
import {Auth} from "../../common/decorators/auth.decorator";
import {Roles} from "../../common/decorators/roles.decorator";
import {AuthenticatedRequest, Role} from "../../common/types/user.types";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";
import {UpdateReportSizeRequestDto, UpdateReportSizeResponseDto} from "./dto/update-report-size.dto";

@ApiTags('reports-sizes')
@Controller('reports-sizes')
export class ReportsSizesController {
    constructor(private readonly reportsSizesService: ReportsSizesService) {
    }

    @Auth()
    @Roles(Role.admin, Role.client)
    @ApiOperation({summary: "Updates existing campaign report sizes or creates new"})
    @ApiResponseDto(UpdateReportSizeResponseDto)
    @Patch()
    updateReportSize(@Req() req: AuthenticatedRequest, @Body() data: UpdateReportSizeRequestDto): Promise<UpdateReportSizeResponseDto> {
        if (!req.user._id) throw new UnauthorizedException('Unauthorized');
        return this.reportsSizesService.updateReportSize({...data, userId: req.user._id});
    }

    @Auth()
    @Roles(Role.admin, Role.client)
    @ApiOperation({summary: "Returns report sizes for authenticated users"})
    @ApiResponseDto(UpdateReportSizeResponseDto)
    @ApiQuery({
        name: 'campaignId',
        required: true,
        type: 'string'
    })
    @Get()
    getReportSizeForUser(@Req() req: AuthenticatedRequest, @Query() campaignId: string): Promise<UpdateReportSizeResponseDto> {
        if (!req.user._id) throw new UnauthorizedException('Unauthorized');
        return this.reportsSizesService.getReportSizeForUser(campaignId, req.user._id);
    }
}
