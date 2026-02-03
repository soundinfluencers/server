import {Body, Controller, Get, Post, Query, Req, Res, UnauthorizedException} from '@nestjs/common';
import {InvoiceService} from './invoice.service';
import {ApiOperation, ApiQuery, ApiTags} from '@nestjs/swagger';
import {CreateInvoiceDto} from './dto/create-invoice.dto';
import {Response} from 'express';
import {Auth} from "../../common/decorators/auth.decorator";
import {Roles} from "../../common/decorators/roles.decorator";
import {AuthenticatedRequest, Role} from "../../common/types/auth.types";
import {ApiResponseDto} from "../../common/decorators/api/response/api-response.decorator";
import {GetInvoicesQueryDto, InvoicesForDashboardDto} from "./dto/invoice.dto";

@ApiTags('invoice')
@Controller('invoice')
export class InvoiceController {
    constructor(private readonly invoiceService: InvoiceService) {
    }

    // @Put('details')
    // updateInvoiceDetails(@Body() data: UpdateInvoiceDetailsDto) {
    //   return this.invoiceService.updateInvoiceDetails(data);
    // }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: "Creates influencer's invoice"})
    @ApiResponseDto(undefined, { successStatusCode: 201 })
    @Post()
    createInvoice(@Req() req: AuthenticatedRequest, @Body() data: CreateInvoiceDto): Promise<void> {
        if (!req.user._id) throw new UnauthorizedException('Unauthorized');
        return this.invoiceService.createInvoice({...data, influencerId: req.user._id});
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: "Gets list of influencer's invoices"})
    @ApiResponseDto(InvoicesForDashboardDto)
    @ApiQuery({
        name: 'limit',
        required: false,
        type: 'number',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: 'number',
    })
    @Get()
    async getInvoices(@Req() req: AuthenticatedRequest, @Query() query: GetInvoicesQueryDto): Promise<InvoicesForDashboardDto> {
        if (!req.user._id) throw new UnauthorizedException('Unauthorized');
        const invoices = await this.invoiceService.getInvoices({...query, influencerId: req.user._id});
        return {invoices};
    }

    @Auth()
    @Roles(Role.influencer, Role.admin)
    @ApiOperation({summary: "Download invoice"})
    @Get('download')
    @ApiQuery({name: 'invoiceId'})
    downloadInvoice(@Query() args: { invoiceId: string }, @Res() res: Response) {
        return this.invoiceService.downloadInvoice(args.invoiceId, res);
    }

    @Auth()
    @Roles(Role.influencer)
    @ApiOperation({summary: "Returns influencer's invoice draft values"})
    @ApiResponseDto(CreateInvoiceDto)
    @Get('draft')
    getDraft(@Req() req: AuthenticatedRequest) {
        return this.invoiceService.getInvoiceDraft(req.user._id);
    }
}
