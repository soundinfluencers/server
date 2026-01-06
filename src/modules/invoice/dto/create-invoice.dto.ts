import {ApiProperty} from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEmail,
    IsPhoneNumber,
    IsNumber,
    IsPositive,
    IsIn,
    IsUUID,
    Length,
} from 'class-validator';

export class CreateInvoiceDto {
    influencerId: string;

    @ApiProperty({required: true, default: 'pending'})
    @IsString()
        // TODO: check invoices statuses
        // @IsIn(['pending', 'paid', 'cancelled'])
    status: string;

    @ApiProperty({required: true})
    @IsString()
    @IsNotEmpty()
    contactName: string;

    @ApiProperty({required: true})
    @IsString()
    @IsNotEmpty()
    contactLastName: string;

    @ApiProperty({required: true})
    @IsPhoneNumber(null)
    contactPhone: string;

    @ApiProperty({required: true})
    @IsEmail()
    contactEmail: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    payee?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    bankName?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    bankBranchName?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    bankCountry?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    @Length(3, 3)
    bankAccountCurrency?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    sortCode?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    accountNumber?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    swiftOrBic?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    companyName?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    companyId?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    street?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    city?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    state?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    postcode?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    country?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsNumber()
    @IsPositive()
    amount?: number;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    vat?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({required: true})
    @IsString()
        // TODO: check payment methods
        // @IsIn(['bank_transfer', 'paypal', 'crypto'])
    selectedPaymentMethod: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    poNumber?: string;
}
