import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseRepository } from '../base.repository';
import {
  RequestNegotiationMessage,
  RequestNegotiationMessageDocument,
} from '../../schemas/negotiation/request-negotiation-message.schema';
import { NegotiationMessageDirection } from '../../../common/types/negotiation/request-negotiation.types';

@Injectable()
export class RequestNegotiationMessageRepository extends BaseRepository<RequestNegotiationMessage> {
  constructor(
    @InjectModel(RequestNegotiationMessage.name)
    private readonly messageModel: Model<RequestNegotiationMessage>,
  ) {
    super(messageModel);
  }

  listByThread(threadId: string): Promise<RequestNegotiationMessageDocument[]> {
    return this.messageModel
      .find({ threadId: new Types.ObjectId(threadId) })
      .sort({ createdAt: 1 })
      .exec();
  }

  findLastByThread(threadId: Types.ObjectId): Promise<RequestNegotiationMessageDocument | null> {
    return this.messageModel.findOne({ threadId }).sort({ createdAt: -1 }).exec();
  }

  // Resolves the thread of a previously-sent message by its RFC 5322 Message-ID.
  // Used as a fallback when plus-addressing did not yield a threadId.
  findByMessageId(messageId: string): Promise<RequestNegotiationMessageDocument | null> {
    return this.messageModel.findOne({ messageId }).exec();
  }

  // Stamps readAt on all not-yet-read inbound messages of a thread.
  async markInboundRead(threadId: Types.ObjectId, at: Date): Promise<void> {
    await this.messageModel
      .updateMany(
        {
          threadId,
          direction: NegotiationMessageDirection.INBOUND,
          readAt: { $exists: false },
        },
        { $set: { readAt: at } },
      )
      .exec();
  }

  // Idempotent insert keyed on the unique messageId. Returns null when the
  // message already exists (e.g. duplicate inbound delivery / webhook retry).
  async insertIfNew(
    data: Partial<RequestNegotiationMessage>,
  ): Promise<RequestNegotiationMessageDocument | null> {
    try {
      return await this.messageModel.create(data);
    } catch (err: any) {
      if (err?.code === 11000) {
        return null;
      }
      throw err;
    }
  }
}
