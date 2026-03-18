import { ApiProperty } from '@nestjs/swagger';

export class SearchListResponseDto<T> {
    @ApiProperty({
        example: 3,
        description: 'Total number of found items',
    })
    total: number;

    @ApiProperty({
        example: 10,
        description: 'Maximum number of returned items',
    })
    limit: number;

    items: T[];
}