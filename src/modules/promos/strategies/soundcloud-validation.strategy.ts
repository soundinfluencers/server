import { BadRequestException } from '@nestjs/common';
import { InfluencerUpdatedPostDetailsDto } from '../dto/influencer-get-promos.dto';
import { SocialMediaValidationStrategy } from '../types/promos.types';

export class SoundcloudValidationStrategy implements SocialMediaValidationStrategy {
  validate(data: InfluencerUpdatedPostDetailsDto) {
    if (!data.screenshotUrl?.trim()) {
      throw new BadRequestException('Screenshot required');
    }
  }
}
