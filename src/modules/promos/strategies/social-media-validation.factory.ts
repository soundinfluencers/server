import { Injectable } from '@nestjs/common';
import { SocialMediaValidationStrategy } from '../types/promos.types';
import { SpotifyValidationStrategy } from './spotify-validation.strategy';
import { PressValidationStrategy } from './press-validation.strategy';
import { DefaultSocialValidationStrategy } from './default-validation.strategy';
import { SoundcloudValidationStrategy } from './soundcloud-validation.strategy';

@Injectable()
export class SocialMediaValidationStrategyFactory {
  private readonly strategies: Record<string, SocialMediaValidationStrategy>;

  constructor() {
    this.strategies = {
      spotify: new SpotifyValidationStrategy(),
      soundcloud: new SoundcloudValidationStrategy(),
      press: new PressValidationStrategy(),
      default: new DefaultSocialValidationStrategy(),
    };
  }

  get(socialMedia: string): SocialMediaValidationStrategy {
    return this.strategies[socialMedia] ?? this.strategies.default;
  }
}
