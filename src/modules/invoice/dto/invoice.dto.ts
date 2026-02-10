import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {IsNumber, IsPositive, IsString} from "class-validator";
import {Type} from "class-transformer";
import {InvoiceForDashboard} from "../../../common/types/influencer/invoice.types";
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

// // dto for returning draft values for new influencer's invoice (invoice details + latest invoice)
// export class InvoiceDraft extends InvoiceDetailsDto {
//     @ApiPropertyOptional({type: String})
//     firstName?: string;
//
//     @ApiPropertyOptional({type: String})
//     lastName?: string;
//
//     @ApiPropertyOptional({type: String})
//     address?: string;
//
//     @ApiPropertyOptional({type: String})
//     country?: string;
//
//     @ApiPropertyOptional({type: String})
//     company?: string;
//
//     @ApiPropertyOptional({type: String})
//     vatNumber?: string;
// }