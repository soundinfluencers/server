import {SocialMediaEnum} from "../../../../common/types/social-media.types";
import {
    HistoryCampaignActionStatus,
    ShortSocialAccountInfo
} from "../../../../common/types/influencer/influencer.types";
import {ApiProperty, ApiPropertyOptional, getSchemaPath} from "@nestjs/swagger";
import {InfluencerHistoryActionType} from "../../../../common/types/history.types";
import {Type} from "class-transformer";

// DTO with influencer's history action (CAMPAIGN) for admin panel
export class AdminInfCampaignActionDto {
    @ApiProperty({ type: String, enum: InfluencerHistoryActionType })
    actionType: InfluencerHistoryActionType;

    @ApiProperty({ type: String, example: "22.10.2026 07:21" })
    dateAndTime: string;

    @ApiProperty({ type: String, enum: SocialMediaEnum })
    socialMedia: SocialMediaEnum;

    @ApiProperty({ type: String })
    username: string;

    @ApiProperty({ type: String })
    campaignName: string;

    @ApiProperty({ type: Number })
    reward: number;

    @ApiProperty({ type: Number, enum: HistoryCampaignActionStatus })
    status: HistoryCampaignActionStatus; // actionNumber

    @ApiProperty({ type: String })
    statusLabel: string; // for UI. use HistoryCampaignActionStatusLabel record

    @ApiProperty({ type: Number })
    currentBalance: number;

    @ApiPropertyOptional({ type: Boolean })
    isStillInCampaign?: boolean; // is this social account still in campaign or was removed
}

// DTO with influencer's history action (INVOICE) for admin panel
export class AdminInfInvoiceActionDto {
    @ApiProperty({ type: String, enum: InfluencerHistoryActionType })
    actionType: InfluencerHistoryActionType;

    @ApiProperty({ type: String })
    invoiceId: string;

    @ApiProperty({ type: Number })
    amount: number;

    @ApiProperty({ type: String })
    paymentMethod: string;

    @ApiProperty({ type: Number })
    currentBalance: number;

    @ApiProperty({ type: String, example: "22.10.2026 07:21" })
    date: string; // example: 22.10.2026 07:21
}

// DTO with short social account info
export class ShortSocialAccountInfoDto implements ShortSocialAccountInfo {
    @ApiProperty({ type: String })
    accountId: string;

    @ApiProperty({ type: String, enum: SocialMediaEnum })
    socialMedia: SocialMediaEnum;

    @ApiProperty({ type: String })
    username: string;

    @ApiProperty({ type: Number })
    price: number;
}

// DTO with paginated influencer's actions history (CAMPAIGNS & INVOICES) for admin panel
export class AdminInfActionsHistoryDto {
    @ApiProperty({ type: String })
    influencerName: string;

    @ApiProperty({
        type: 'array',
        items: {
            oneOf: [
                { $ref: getSchemaPath(AdminInfCampaignActionDto) },
                { $ref: getSchemaPath(AdminInfInvoiceActionDto) },
            ],
        },
    })
    @Type(() => Object)
    actions: (AdminInfCampaignActionDto | AdminInfInvoiceActionDto)[];

    @ApiProperty({ type: ShortSocialAccountInfoDto, isArray: true })
    accounts: ShortSocialAccountInfo[];

    @ApiPropertyOptional({ type: String })
    currencyNote?: string;
}
