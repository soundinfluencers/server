import { ValidateNested, IsString, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class NewCampaignActionDto {
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
    @IsString()
    influencerId: string;

    @IsString()
    invoiceId: string;

    @IsString()
    paymentMethod: string;

    @IsNumber()
    currentBalance: number;

    @IsNumber()
    amount: number;
}
