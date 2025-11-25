import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ReportsSizesService } from './reports-sizes.service';
import { UpdateReportSizeDto } from './dto/update-report-size.dto';
import { GetReportSizeDto } from './dto/get-report-size.dto';
import {ApiTags} from "@nestjs/swagger";

@ApiTags('reports-sizes')
@Controller('reports-sizes')
export class ReportsSizesController {
  constructor(private readonly reportsSizesService: ReportsSizesService) {}

  @Patch('update')
  updateReportSize(@Body() data: UpdateReportSizeDto) {
    return this.reportsSizesService.updateReportSize(data);
  }

  @Post('get-report-sizes')
  getReportSizeForUser(@Body() data: GetReportSizeDto) {
    return this.reportsSizesService.getReportSizeForUser(data);
  }
}
