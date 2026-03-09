import {ValidateNested, IsString, IsNumber, IsOptional, IsMongoId, IsEnum} from 'class-validator';
import { Type } from 'class-transformer';
import {Types} from "mongoose";
import {InvoicePaymentMethodEnum} from "../../../common/types/invoice.types";

export class NewCampaignActionDto {
    addedAccountsId: Types.ObjectId;
    socialAccountId: Types.ObjectId;

    @IsNumber()
    actionNumber: number;

    @IsString()
    networkUsername: string;

    @IsOptional()
    @IsNumber()
    rewardForInfluencer?: number;

    @IsOptional()
    @IsString()
    socialMedia?: string;
}

// request body for upserting new campaign action into influencer's history
export class UpsertCampaignActionDto {
    @IsString()
    influencerId: string;

    @IsString()
    campaignId: string;

    @IsString()
    campaignName: string;

    @ValidateNested()
    @Type(() => NewCampaignActionDto)
    updatedCampaignAction: NewCampaignActionDto;
}

// request body for upserting new invoice action into influencer's history
export class UpsertInvoiceActionDto {
    @IsMongoId()
    influencerId: string;

    @IsMongoId()
    invoiceId: string;

    @IsEnum(InvoicePaymentMethodEnum)
    paymentMethod: InvoicePaymentMethodEnum;

    @IsNumber()
    currentBalance: number;

    @IsNumber()
    amount: number;
}
