import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaStrategyFactory } from './media.factory';
import { DropboxMediaStrategy } from './strategies/dropbox.strategy';
import { DirectMediaStrategy } from './strategies/direct.strategy';
import { GdriveMediaStrategy } from './strategies/gdrive.strategy';
import DropboxService from '../../integrations/dropbox/dropbox';
import GoogleDriveService from '../../integrations/gdrive/gdrive';

@Module({
  providers: [
    MediaService,
    MediaStrategyFactory,
    DropboxMediaStrategy,
    GdriveMediaStrategy,
    DirectMediaStrategy,
    DropboxService,
    GoogleDriveService,
  ],
  exports: [MediaService],
})
export class MediaModule {}
