import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
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
    Length, IsEnum, ValidateIf, ValidateNested,
} from 'class-validator';
import {InvoicePaymentMethodEnum} from "../../../common/types/influencer/invoice.types";
import {Type} from "class-transformer";

// dto for UK Bank Transfer payment method
export class UKBankTransferDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    beneficiary: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    beneficiaryAddress: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    sortCode: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    accountNumber: string;
}

// dto for International Bank Transfer payment method
export class InternationalBankTransferDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    beneficiary: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    beneficiaryAddress: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    iban: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    bankName: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    bankCountry: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    bankAccountCurrency: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    swiftBicCode: string;
}

// dto for PayPal payment method
export class PayPalDto {
    @ApiProperty()
    @IsEmail()
    paypalEmail?: string;
}

// dto for creating new influencer's invoice
export class CreateInvoiceDto {
    influencerId?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    firstName: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    lastName: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    address: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    country: string;

    @ApiProperty()
    @IsNumber()
    amount: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    company?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    vatNumber?: string;

    @ApiProperty()
    @IsEnum(InvoicePaymentMethodEnum)
    selectedPaymentMethod: InvoicePaymentMethodEnum;

    @ApiPropertyOptional({ type: () => UKBankTransferDto })
    @ValidateIf(o => o.selectedPaymentMethod === InvoicePaymentMethodEnum.ukBankTransfer)
    @ValidateNested()
    @Type(() => UKBankTransferDto)
    ukBankTransfer?: UKBankTransferDto;

    @ApiPropertyOptional({ type: () => InternationalBankTransferDto })
    @ValidateIf(o => o.selectedPaymentMethod === InvoicePaymentMethodEnum.internationalBankTransfer)
    @ValidateNested()
    @Type(() => InternationalBankTransferDto)
    internationalBankTransfer?: InternationalBankTransferDto;

    @ApiPropertyOptional({ type: () => PayPalDto })
    @ValidateIf(o => o.selectedPaymentMethod === InvoicePaymentMethodEnum.paypal)
    @ValidateNested()
    @Type(() => PayPalDto)
    paypal?: PayPalDto;
}
