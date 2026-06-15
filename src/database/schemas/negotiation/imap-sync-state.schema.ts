import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ImapSyncStateDocument = HydratedDocument<ImapSyncState>;

@Schema({
  timestamps: true,
  collection: 'imap_sync_state',
  strict: 'throw',
})
export class ImapSyncState {
  @Prop({ required: true, type: String, unique: true, trim: true })
  mailbox: string;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  lastSeenUid: number;

  @Prop({ type: String })
  lockOwner?: string;

  @Prop({ type: Date })
  lockExpiresAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const ImapSyncStateSchema = SchemaFactory.createForClass(ImapSyncState);
