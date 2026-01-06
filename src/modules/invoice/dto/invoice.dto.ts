import { ApiProperty } from '@nestjs/swagger';
import {IsNumber, IsPositive, IsString} from "class-validator";
import {Type} from "class-transformer";
import {InvoiceForDashboard} from "../../../common/types/influencer/invoice.types";

export class GetInvoicesQueryDto {
    @ApiProperty({ required: true, example: 10 })
    @Type(() => Number)
    @IsNumber()
    @IsPositive()
    limit: number;

    @ApiProperty({ required: true, example: 1 })
    @Type(() => Number)
    @IsNumber()
    @IsPositive()
    page: number;

    influencerId: string;
}

// dto for one invoice from influencer's dashboard
export class InvoiceForDashboardDto implements InvoiceForDashboard {
    @ApiProperty({ example: 'a1b2' })
    shortInvoiceId: string;

    @ApiProperty({ example: '14.01.2026' })
    creationDate: string;

    @ApiProperty({ example: 'Paypal' })
    paymentMethod: string;

    @ApiProperty({ example: 250 })
    amount: number;

    @ApiProperty({ example: 'Submitted' })
    status: string;
}

// dto for an array invoices from influencer's dashboard
export class InvoicesForDashboardDto {
    @ApiProperty({
        type: InvoiceForDashboardDto,
        isArray: true,
    })
    invoices: InvoiceForDashboardDto[];
}