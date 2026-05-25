import { Injectable } from '@nestjs/common';
import { DropboxMediaStrategy } from './strategies/dropbox.strategy';
import { DirectMediaStrategy } from './strategies/direct.strategy';
import { GdriveMediaStrategy } from './strategies/gdrive.strategy';
import { MediaStrategy } from './strategies/media.strategy';
import { MediaProviderEnum } from '../../common/types/file/file.types';

@Injectable()
export class MediaStrategyFactory {
  constructor(
    private readonly dropbox: DropboxMediaStrategy,
    private readonly gdrive: GdriveMediaStrategy,
    private readonly direct: DirectMediaStrategy,
  ) {}

  getStrategy(mainLink: string): MediaStrategy {
    if (this.dropbox.canHandle(mainLink)) return this.dropbox;
    if (this.gdrive.canHandle(mainLink)) return this.gdrive;
    return this.direct;
  }

  getStrategyByProvider(provider: MediaProviderEnum): MediaStrategy {
    switch (provider) {
      case MediaProviderEnum.direct:
        return this.direct;
      case MediaProviderEnum.dropbox:
        return this.dropbox;
      case MediaProviderEnum.gdrive:
        return this.gdrive;
      default:
        return this.direct;
    }
  }
}
