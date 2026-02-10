import {Injectable} from '@nestjs/common';
import {DropboxMediaStrategy} from './strategies/dropbox.strategy';
import {DirectMediaStrategy} from './strategies/direct.strategy';
import {MediaStrategy} from './strategies/media.strategy';
import {MediaProviderEnum} from "../../common/types/file/file.types";

@Injectable()
export class MediaStrategyFactory {
    constructor(
        private readonly dropbox: DropboxMediaStrategy,
        private readonly direct: DirectMediaStrategy,
    ) {
    }

    getStrategy(mainLink: string): MediaStrategy {
        if (this.dropbox.canHandle(mainLink)) return this.dropbox;
        return this.direct;
    }

    getStrategyByProvider(provider: MediaProviderEnum): MediaStrategy {
        switch (provider) {
            case MediaProviderEnum.direct:
                return this.direct;
            case MediaProviderEnum.dropbox:
                return this.dropbox;
            default:
                return this.direct;
        }
    }
}
