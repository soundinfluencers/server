import { IntersectionType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { SearchQueryDto } from '../../../../common/dto/requests/search-query.dto';
import { PaginationQueryDto } from '../../../../common/dto/requests/pagination-query.dto';
import { SocialMediaEnum } from '../../../../common/types/social-media.types';

export class AdminInfluencersQueryDto extends IntersectionType(SearchQueryDto, PaginationQueryDto) {
    @ApiPropertyOptional({
        description: 'Filter by social media platform',
        enum: SocialMediaEnum,
        example: 'instagram',
    })
    @IsOptional()
    @IsEnum(SocialMediaEnum)
    platform?: SocialMediaEnum;
}
