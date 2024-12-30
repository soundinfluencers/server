import {ApiProperty} from "@nestjs/swagger";

export class UpsertInvoiceHistoryDto {
    @ApiProperty({ required: true, type: String })
    influencerId: string;

    @ApiProperty({ type: String, required: false, default: '' })
    invoiceId: string;
    
    @ApiProperty({ type: String, required: true, default: '' })
    paymentMethod: string;
    
    @ApiProperty({ type: Number, required: true })
    currentBalance: number;
    
    @ApiProperty({ type: Number, required: true })
    amount: number;
}
