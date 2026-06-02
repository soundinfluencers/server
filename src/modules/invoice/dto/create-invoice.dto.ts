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
import {InvoicePaymentMethodEnum} from "../../../common/types/invoice.types";
import {Type} from "class-transformer";
import {InternationalBankTransferDto, PayPalDto, UKBankTransferDto} from "../../profile/dto/payment-details.dto";
import {Role} from "../../../common/types/user.types";
import {CampaignPaymentMethodEnum} from "../../../common/types/client/campaign.types";
import {InfluencerInvoiceLinkedPromo} from "../../../database/schemas/invoices/user-invoice.schema";

// dto for creating new influencer's invoice
export class CreateInvoiceDto {
    // front does not send this. this field is setting and using only by backend
    userId?: string;
    // front does not send this. this field is setting and using only by backend
    userRole?: Role;
    // front does not send this. this field is setting and using only by backend
    linkedPromos?: InfluencerInvoiceLinkedPromo[];

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

    amount?: number;

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
    // only for client campaign invoice
    // front does not send this. this field is setting and using only by backend
    campaignFollowers?: number;
    // only for client campaign invoice
    // front does not send this. this field is setting and using only by backend
    reach?: number;

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
    @IsString()
    @IsNotEmpty()
    referenceNumber: string;

    @ApiPropertyOptional()
    @IsOptional()
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

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    poNumber?: string;

    @ApiProperty()
    @IsEnum(CampaignPaymentMethodEnum)
    selectedPaymentMethod: CampaignPaymentMethodEnum;
}