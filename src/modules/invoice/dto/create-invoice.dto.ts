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
import {InternationalBankTransferDto, PayPalDto, UKBankTransferDto} from "../../profile/dto/payment-details.dto";

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
