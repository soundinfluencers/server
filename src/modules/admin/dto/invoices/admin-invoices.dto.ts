import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {InvoicePaymentMethodEnum, InvoiceStatusEnum} from "../../../../common/types/invoice.types";
import {PaginatedListResponseDto} from "../../../../common/dto/responses/paginated-list-response.dto";
import {SearchListResponseDto} from "../../../../common/dto/responses/search-response.dto";
import {SocialMediaEnum} from "../../../../common/types/social-media.types";

// DTO with client invoice fields for admin table
export class AdminClientInvoiceRow {
    @ApiProperty({type: String})
    invoiceId: string;

    @ApiProperty({type: String})
    company: string;

    @ApiProperty({type: String})
    campaignName: string;

    @ApiProperty({type: String})
    date: string;

    @ApiProperty({type: Number})
    amount: number;

    @ApiProperty({type: String, enum: InvoiceStatusEnum})
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

// DTO with influencer invoice fields for admin table
export class AdminInfluencerInvoiceRow {
    @ApiProperty({type: String})
    invoiceId: string;

    @ApiProperty({type: String})
    firstName: string;

    @ApiPropertyOptional({type: String})
    lastName?: string;

    @ApiProperty({type: String, enum: SocialMediaEnum})
    socialMedia: SocialMediaEnum; // influencer first social account social media

    @ApiProperty({type: String})
    username: string; // influencer first social account username

    @ApiProperty({type: String})
    date: string;

    @ApiProperty({type: Number})
    influencerAmount: number;

    @ApiProperty({type: Number})
    amountInEur: number;

    @ApiProperty({type: String, enum: InvoicePaymentMethodEnum})
    paymentMethod: InvoicePaymentMethodEnum;

    @ApiProperty({type: String})
    paymentDetails: string;

    @ApiProperty({type: String, enum: InvoiceStatusEnum})
    status: InvoiceStatusEnum;

    @ApiProperty({type: Boolean})
    isPaid: boolean;
}

// DTO for influencers invoices list
export class AdminInfluencerInvoicesListResponseDto extends PaginatedListResponseDto<AdminInfluencerInvoiceRow> {
    @ApiProperty({
        type: [AdminInfluencerInvoiceRow],
        description: 'List of influencers invoices',
    })
    items: AdminInfluencerInvoiceRow[];
}

// DTO for influencers invoices search result
export class AdminInfluencerInvoicesSearchResponseDto extends SearchListResponseDto<AdminInfluencerInvoiceRow> {
    @ApiProperty({
        type: [AdminInfluencerInvoiceRow],
        description: 'List of influencers invoices',
    })
    items: AdminInfluencerInvoiceRow[];
}