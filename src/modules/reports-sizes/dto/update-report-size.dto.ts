import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {IsString} from "class-validator";
import {UpdateReportSizeResponse} from "../types/report-size.types";

export class UpdateReportSizeRequestDto {
    @ApiProperty({
        example: '68cd74a0abb8681cf1d57183'
    })
    @IsString()
    campaignId: string;

    @ApiProperty()
    columnSizes: object[];

    userId: string;
}

export class UpdateReportSizeResponseDto implements UpdateReportSizeResponse {
    @ApiProperty()
    message?: string;

    @ApiPropertyOptional({
        type: 'array',
        additionalProperties: { type: 'number' },
    })
    sizes?: Record<string, number>[];
}
