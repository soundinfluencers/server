import { SocialMediaValidationStrategy } from '../types/promos.types';
import { InfluencerUpdatedPostDetailsDto } from '../dto/influencer-get-promos.dto';
import { BadRequestException } from '@nestjs/common';

export class PressValidationStrategy implements SocialMediaValidationStrategy {
  validate(data: InfluencerUpdatedPostDetailsDto) {
    if (!data.postLink?.trim()) {
      throw new BadRequestException('Post link required');
    }
  }
}
