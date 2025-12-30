import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {InfluencerActionsHistory} from "../../../database/schemas/histories/influencer-actions-history.schema";

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
