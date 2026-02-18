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
    Length, IsEnum, ValidateIf, ValidateNested, Min,
} from 'class-validator';
import {InvoicePaymentMethodEnum} from "../../../common/types/influencer/invoice.types";
import {Type} from "class-transformer";
import {InternationalBankTransferDto, PayPalDto, UKBankTransferDto} from "../../profile/dto/payment-details.dto";
import {Role} from "../../../common/types/user.types";
import {CampaignPaymentMethodEnum} from "../../../common/types/client/campaign.types";

// dto for creating new influencer's invoice
export class CreateInvoiceDto {
    // front does not send this. this field is setting and using only by backend
    userId?: string;
    // front does not send this. this field is setting and using only by backend
    userRole?: Role;
    // only for client campaign invoice
    // front does not send this. this field is setting and using only by backend
    campaignId?: string;
    // only for client campaign invoice
    // front does not send this. this field is setting and using only by backend
    campaignName?: string;

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
    @Min(1)
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

// dto for creating new campaign invoice
export class CreateCampaignInvoiceDto {
    // front does not send this. this field is setting and using only by backend
    userId?: string;
    // front does not send this. this field is setting and using only by backend
    userRole?: Role;
    // only for client campaign invoice
    // front does not send this. this field is setting and using only by backend
    campaignId?: string;
    // only for client campaign invoice
    // front does not send this. this field is setting and using only by backend
    campaignName?: string;

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
    @IsEnum(CampaignPaymentMethodEnum)
    selectedPaymentMethod: CampaignPaymentMethodEnum;
}