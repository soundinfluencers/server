import {ApiProperty, ApiPropertyOptional, getSchemaPath} from "@nestjs/swagger";
import {InfluencerActionsHistory} from "../../../database/schemas/histories/influencer-actions-history.schema";
import {ProcessedInfluencerHistory} from "../types/influencer-history.types";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {Type} from "class-transformer";
import {HistoryCampaignActionStatus} from "../../../common/types/influencer/influencer.types";
import {IsNumber, IsOptional} from "class-validator";

export class GetAllHistoriesQueryDto {
    @ApiPropertyOptional({
        default: 10,
    })
    limit: number;

    @ApiPropertyOptional({
        default: 1,
        description: 'Page number (starts from 1)',
    })
    page: number;
}

export class AllHistoriesResponseDto {
    @ApiProperty({ type: () => [InfluencerActionsHistory] })
    histories: InfluencerActionsHistory[]
}

// TODO: finish
class AccountForProcessedHistory {
    @ApiProperty()
    accountId: string;

    @ApiProperty({ enum: SocialMediaEnum })
    socialMedia: SocialMediaEnum;

    @ApiProperty()
    username: string;

    @ApiProperty()
    publicPrice: number | string;
}

export class GetCurrentUserCampaignsHistoryQueryDto {
    @ApiPropertyOptional({
        default: 12,
    })
    @Type(() => Number)
    @IsNumber({}, {
        message: 'limit must be a number'
    })
    @IsOptional()
    limit: number;

    @ApiPropertyOptional({
        default: 1,
        description: 'Page number (starts from 1)',
    })
    @Type(() => Number)
    @IsNumber({}, {
        message: 'page must be a number'
    })
    @IsOptional()
    page: number;

    influencerId: string;
}

export class HistoryCampaignItemForProcessedHistory {
    @ApiProperty()
    type?: 'campaign';

    @ApiProperty()
    campaignId: string;

    @ApiProperty()
    campaignName: string;

    @ApiProperty({type: 'string', enum: [...Object.values(SocialMediaEnum), 'multipromo']})
    campaignSocialMedia: SocialMediaEnum | 'multipromo';

    @ApiProperty()
    addedAccountsId: string | null;

    @ApiProperty()
    socialAccountId: string;

    @ApiProperty()
    price: number;

    @ApiProperty({
        enum: HistoryCampaignActionStatus,
        example: HistoryCampaignActionStatus.inDistribution,
        description: 'Campaign status code',
    })
    status: HistoryCampaignActionStatus;

    @ApiProperty({
        example: 'In Distribution',
        description: 'Human readable campaign status',
    })
    statusLabel: string;

    @ApiProperty()
    date: Date;

    @ApiPropertyOptional()
    currentBalance?: number;
}

export class CurrentUserCampaignHistoryDto {
    @ApiProperty({ type: HistoryCampaignItemForProcessedHistory, isArray: true })
    history: HistoryCampaignItemForProcessedHistory[];
}

// todo: закончить тип invoice action (сейчас просто заглушка)
class HistoryInvoiceItemForProcessedHistory {
    @ApiProperty()
    type: 'invoice';

    @ApiProperty()
    title: string;

    @ApiProperty()
    amount: number;

    @ApiProperty()
    currentBalance: number;

    @ApiProperty()
    date: Date;
}

export type HistoryItemForProcessedHistory =
    | HistoryCampaignItemForProcessedHistory
    | HistoryInvoiceItemForProcessedHistory;

export class OneHistoryResponseDto implements ProcessedInfluencerHistory {
    @ApiProperty()
    influencerId: string;

    @ApiProperty()
    influencerEmail: string;

    @ApiProperty()
    influencerName: string;

    @ApiProperty({ type: AccountForProcessedHistory, isArray: true })
    @Type(() => AccountForProcessedHistory)
    accountsUsernames: AccountForProcessedHistory[];

    @ApiProperty()
    currencyNote: string;

    @ApiProperty({
        isArray: true,
        oneOf: [
            { $ref: getSchemaPath(HistoryCampaignItemForProcessedHistory) },
            { $ref: getSchemaPath(HistoryInvoiceItemForProcessedHistory) },
        ],
    })
    history: HistoryItemForProcessedHistory[];
}