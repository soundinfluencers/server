import {Body, Controller, Get, Post, Query, Res} from '@nestjs/common';
import {InvoiceService} from './invoice.service';
import {ApiQuery, ApiTags} from '@nestjs/swagger';
import {CreateInvoiceDtoDto} from './dto/create-invoice.dto';
import {Response} from 'express';
import {Auth} from "../../common/decorators/auth.decorator";
import {Roles} from "../../common/decorators/roles.decorator";
import {Role} from "../../common/types/auth.types";

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
    @Post()
    createInvoice(@Body() data: CreateInvoiceDtoDto) {
        return this.invoiceService.createInvoice(data);
    }

    @ApiQuery({name: 'influencerId'})
    @Get()
    getInvoices(@Query() args: { influencerId: string }) {
        return this.invoiceService.getInvoices(args.influencerId);
    }

    @ApiQuery({name: 'influencerId'})
    @Get('saved')
    getInvoiceSave(@Query() args: { influencerId: string }) {
        return this.invoiceService.getInvoiceSave(args.influencerId);
    }

    @Get('download')
    @ApiQuery({name: 'invoiceId'})
    downloadInvoice(@Query() args: { invoiceId: string }, @Res() res: Response) {
        return this.invoiceService.downloadInvoice(args.invoiceId, res);
    }
}
