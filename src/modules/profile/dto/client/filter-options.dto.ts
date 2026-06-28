import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FilterOptionDto {
    @ApiProperty({ type: String })
    id: string;

    @ApiProperty({ type: String })
    group: string;

    @ApiProperty({ type: String })
    filterName: string;

    @ApiProperty({ example: 328 })
    count: number;

    @ApiPropertyOptional({ type: () => [FilterOptionDto] })
    children?: FilterOptionDto[];
}

export class AndOrFlagDto {
    @ApiProperty({ enum: ['And', 'Or'], example: 'And' })
    method: 'And' | 'Or';
}

export class FilterBlockDto {
    @ApiProperty({ example: 'community-music-genres' })
    id: string;

    @ApiProperty({ example: 'Community Music Genres' })
    title: string;

    @ApiPropertyOptional({ type: () => [AndOrFlagDto] })
    AndOrFlag?: AndOrFlagDto[];

    @ApiProperty({ type: () => [FilterOptionDto] })
    filters: FilterOptionDto[];
}

export class GetFilterOptionsDataDto {
    @ApiProperty({ type: () => [FilterBlockDto] })
    filterArr: FilterBlockDto[];
}
