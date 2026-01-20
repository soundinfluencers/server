import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class MigrateCampaignsDto {
    @ApiPropertyOptional({ example: 200, description: 'Batch size' })
    @IsOptional()
    @IsInt()
    @Min(1)
    limit?: number = 200;

    @ApiPropertyOptional({
        example: '6890c18c8bab18e54d053bca',
        description: 'Start after this _id (hex string). Useful to continue migration.',
    })
    @IsOptional()
    startAfterId?: string;

    @ApiPropertyOptional({
        example: true,
        description: 'If true, only log what would be migrated (no writes).',
    })
    @IsOptional()
    dryRun?: boolean = false;
}
