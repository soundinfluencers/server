import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {InvoicePaymentMethodEnum} from "../../../common/types/influencer/invoice.types";
import {IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf, ValidateNested} from "class-validator";
import {Type} from "class-transformer";


// -------------- BASE CLASSES ---------------


// dto for UK Bank Transfer payment method
export class UKBankTransferDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    beneficiary: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    beneficiaryAddress: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    sortCode: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    accountNumber: string;
}

// dto for International Bank Transfer payment method
export class InternationalBankTransferDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    beneficiary: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    beneficiaryAddress: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    iban: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    bankName: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    bankCountry: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    bankAccountCurrency: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    swiftBicCode: string;
}

// dto for PayPal payment method
export class PayPalDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsEmail()
    paypalEmail?: string;
}


// -------------- REQUESTS ---------------

export enum PaymentMethodRequestEnum {
    ukBankTransfer = 'ukBankTransfer',
    internationalBankTransfer = 'internationalBankTransfer',
    paypal = 'paypal',
    all = 'all'
}

// dto request for updating user's payment details
export class UpdatePaymentDetailsDto {
    @ApiProperty()
    @IsEnum(InvoicePaymentMethodEnum)
    selectedPaymentMethod: InvoicePaymentMethodEnum;

    @ApiPropertyOptional({type: () => UKBankTransferDto})
    @ValidateIf(o => o.selectedPaymentMethod === InvoicePaymentMethodEnum.ukBankTransfer)
    @ValidateNested()
    @Type(() => UKBankTransferDto)
    ukBankTransfer?: UKBankTransferDto;

    @ApiPropertyOptional({type: () => InternationalBankTransferDto})
    @ValidateIf(o => o.selectedPaymentMethod === InvoicePaymentMethodEnum.internationalBankTransfer)
    @ValidateNested()
    @Type(() => InternationalBankTransferDto)
    internationalBankTransfer?: InternationalBankTransferDto;

    @ApiPropertyOptional({type: () => PayPalDto})
    @ValidateIf(o => o.selectedPaymentMethod === InvoicePaymentMethodEnum.paypal)
    @ValidateNested()
    @Type(() => PayPalDto)
    paypal?: PayPalDto;
}


// -------------- RESPONSES ---------------


// dto for returning diff payment methods details
export class PaymentDetailsDto {
    @ApiPropertyOptional({type: () => UKBankTransferDto})
    @ValidateIf((_, value) => value != null)
    @ValidateNested()
    @Type(() => UKBankTransferDto)
    ukBankTransfer?: UKBankTransferDto;

    @ApiPropertyOptional({type: () => InternationalBankTransferDto})
    @ValidateIf((_, value) => value != null)
    @ValidateNested()
    @Type(() => InternationalBankTransferDto)
    internationalBankTransfer?: InternationalBankTransferDto;

    @ApiPropertyOptional({type: () => PayPalDto})
    @ValidateIf((_, value) => value != null)
    @ValidateNested()
    @Type(() => PayPalDto)
    paypal?: PayPalDto;
}