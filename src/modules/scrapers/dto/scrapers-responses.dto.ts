import { UpdatePostDetailsResponse } from '../types/scraper-response.types';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePostDetailsResponseDto implements UpdatePostDetailsResponse {
  @ApiProperty({
    example: 'Techno TV post details updated!',
  })
  message: string;

  @ApiProperty({
    example: 100,
  })
  newImpressions: number;

  @ApiProperty({
    example: 50,
  })
  newLikes: number;

  @ApiProperty({
    example: 25,
  })
  newComments: number;

  @ApiProperty({
    example: 25,
  })
  newShares: number;

  @ApiProperty({
    example: 25,
  })
  newSaves: number;
}

export class UpdateAllPostDetailsResponseDto {
  @ApiProperty({
    example: 'Processed 10 accounts in batches of 20, retried 2',
  })
  message: string;
}

export class UpdateAllAccountsResponseDto {
  @ApiProperty({
    example: 'Processed 10 instagram accounts in batches of 20',
  })
  message: string;
}
