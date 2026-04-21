import {ApiProperty} from "@nestjs/swagger";
import {InvoiceStatusEnum} from "../../../../common/types/invoice.types";
import {PaginatedListResponseDto} from "../../../../common/dto/responses/paginated-list-response.dto";
import {SearchListResponseDto} from "../../../../common/dto/responses/search-response.dto";

// DTO with client invoice fields for admin table
export class AdminClientInvoiceRow {
    @ApiProperty({ type: String })
    invoiceId: string;

    @ApiProperty({ type: String })
    company: string;

    @ApiProperty({ type: String })
    campaignName: string;

    @ApiProperty({ type: String })
    date: string;

    @ApiProperty({ type: Number })
    amount: number;

    @ApiProperty({ type: String, enum: InvoiceStatusEnum })
    status: InvoiceStatusEnum;
}

// DTO for clients invoices list
export class AdminClientInvoicesListResponseDto extends PaginatedListResponseDto<AdminClientInvoiceRow> {
    @ApiProperty({
        type: [AdminClientInvoiceRow],
        description: 'List of clients invoices',
    })
    items: AdminClientInvoiceRow[];
}

// DTO for clients invoices search result
export class AdminClientInvoicesSearchResponseDto extends SearchListResponseDto<AdminClientInvoiceRow> {
    @ApiProperty({
        type: [AdminClientInvoiceRow],
        description: 'List of clients invoices',
    })
    items: AdminClientInvoiceRow[];
}