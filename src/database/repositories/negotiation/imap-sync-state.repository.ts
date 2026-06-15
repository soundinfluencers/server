import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../base.repository';
import {
  ImapSyncState,
  ImapSyncStateDocument,
} from '../../schemas/negotiation/imap-sync-state.schema';

@Injectable()
export class ImapSyncStateRepository extends BaseRepository<ImapSyncState> {
  constructor(
    @InjectModel(ImapSyncState.name)
    private readonly syncStateModel: Model<ImapSyncState>,
  ) {
    super(syncStateModel);
  }

  findByMailbox(mailbox: string): Promise<ImapSyncStateDocument | null> {
    return this.syncStateModel.findOne({ mailbox }).exec();
  }

  async getLastSeenUid(mailbox: string): Promise<number> {
    const state = await this.findByMailbox(mailbox);
    return state?.lastSeenUid ?? 0;
  }

  async markUidProcessed(mailbox: string, uid: number): Promise<void> {
    await this.syncStateModel
      .updateOne(
        { mailbox },
        {
          $setOnInsert: { mailbox },
          $max: { lastSeenUid: uid },
        },
        { upsert: true },
      )
      .exec();
  }
}
