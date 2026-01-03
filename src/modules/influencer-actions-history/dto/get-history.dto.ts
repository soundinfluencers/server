import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {InfluencerActionsHistory} from "../../../database/schemas/histories/influencer-actions-history.schema";
import {ProcessedInfluencerHistory} from "../../../database/types/histories/influencer-history.types";
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

// TODO: finish
class HistoryItemForProcessedHistory {
    @ApiProperty({ enum: { campaign: 'campaign', invoice: 'invoice' } })
    type: 'campaign' | 'invoice';

    @ApiProperty()
    title: string;

    @ApiProperty()
    amount: number;

    @ApiProperty()
    currentBalance: number;

    @ApiProperty()
    date: Date;
}

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