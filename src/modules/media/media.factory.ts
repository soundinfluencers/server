import { Injectable } from '@nestjs/common';
import { DropboxMediaStrategy } from './strategies/dropbox.strategy';
import { DirectMediaStrategy } from './strategies/direct.strategy';
import { MediaStrategy } from './strategies/media.strategy';

@Injectable()
export class MediaStrategyFactory {
    constructor(
        private readonly dropbox: DropboxMediaStrategy,
        private readonly direct: DirectMediaStrategy,
    ) {}

    getStrategy(mainLink: string): MediaStrategy {
        if (this.dropbox.canHandle(mainLink)) return this.dropbox;
        return this.direct;
    }

    getDropbox(): MediaStrategy {
        return this.dropbox;
    }
}
