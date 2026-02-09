import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaStrategyFactory } from './media.factory';
import { DropboxMediaStrategy } from './strategies/dropbox.strategy';
import { DirectMediaStrategy } from './strategies/direct.strategy';
import DropboxService from '../../integrations/dropbox/dropbox';

@Module({
    providers: [
        MediaService,
        MediaStrategyFactory,
        DropboxMediaStrategy,
        DirectMediaStrategy,
        DropboxService,
    ],
    exports: [MediaService],
})
export class MediaModule {}
