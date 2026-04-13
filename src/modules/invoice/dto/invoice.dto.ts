import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString} from "class-validator";
import {Type} from "class-transformer";
import {BaseDetailedInvoice, ClientDetailedInvoice, InvoiceForDashboard} from "../../../common/types/invoice.types";
import {InvoiceDetailsDto} from "../../profile/dto/invoice-details.dto";

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
}

// dto for one invoice from influencer's dashboard
export class InvoiceForDashboardDto implements InvoiceForDashboard {
    @ApiProperty({ example: 'a1b2' })
    invoiceId: string;

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

    @ApiPropertyOptional({example: 'Test campaign'})
    campaignName?: string;
}

// dto for an array invoices from influencer's dashboard
export class InvoicesForDashboardDto {
    @ApiProperty({
        type: InvoiceForDashboardDto,
        isArray: true,
    })
    invoices: InvoiceForDashboardDto[];
}

// dto client detailed invoice
export class ClientDetailedInvoiceDto implements ClientDetailedInvoice {
    @ApiProperty({type: String})
    @IsString()
    @IsNotEmpty()
    invoiceId: string;

    @ApiProperty({type: String})
    @IsString()
    @IsNotEmpty()
    creationDate: string;

    @ApiProperty({type: String})
    @IsNotEmpty()
    @IsNumber()
    @IsPositive()
    @Type(() => Number)
    amount: number;

    @ApiProperty({type: String})
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @ApiProperty({type: String})
    @IsString()
    @IsNotEmpty()
    country: string;

    @ApiProperty({type: String})
    @IsString()
    @IsNotEmpty()
    address: string;

    @ApiProperty({type: String})
    @IsString()
    @IsNotEmpty()
    campaignName: string;

    @ApiProperty({type: Number})
    @IsNumber()
    campaignFollowers: number | null;

    @ApiPropertyOptional({type: String})
    @IsOptional()
    @IsNotEmpty()
    @IsString()
    company?: string;

    @ApiPropertyOptional({type: String})
    @IsOptional()
    @IsNotEmpty()
    @IsString()
    poNumber?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNotEmpty()
    @IsString()
    vatNumber?: string;
}