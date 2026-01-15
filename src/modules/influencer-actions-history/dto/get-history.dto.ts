import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {InfluencerActionsHistory} from "../../../database/schemas/histories/influencer-actions-history.schema";
import {ProcessedInfluencerHistory} from "../types/influencer-history.types";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {Type} from "class-transformer";

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

class HistoryCampaignItemForProcessedHistory {
    @ApiProperty()
    type: 'campaign';

    @ApiProperty()
    campaignName: string;

    @ApiProperty()
    campaignSocialMedia: SocialMediaEnum;


    @ApiProperty()
    amount: number;

    @ApiProperty()
    currentBalance: number;

    @ApiProperty()
    date: Date;
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

class HistoryItemForProcessedHistory = HistoryCampaignItemForProcessedHistory | HistoryInvoiceItemForProcessedHistory;

// TODO: finish (сейчас просто заглушка)
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

    @ApiProperty({ type: HistoryItemForProcessedHistory, isArray: true })
    @Type(() => HistoryItemForProcessedHistory)
    history: HistoryItemForProcessedHistory[];
}