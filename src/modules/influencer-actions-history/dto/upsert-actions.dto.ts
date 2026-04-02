import {
    ValidateNested,
    IsString,
    IsNumber,
    IsOptional,
    IsMongoId,
    IsEnum,
    IsArray,
    ArrayNotEmpty
} from 'class-validator';
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

class NewCampaignActionForInsertManyDto {
    @IsString()
    campaignId: string;

    @IsString()
    campaignName: string;

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

// request body for upserting array of new campaign actions into influencer's history
export class UpsertCampaignActionsDto {
    @IsString()
    influencerId: string;

    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => NewCampaignActionForInsertManyDto)
    updatedCampaignActions: NewCampaignActionForInsertManyDto[];
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
