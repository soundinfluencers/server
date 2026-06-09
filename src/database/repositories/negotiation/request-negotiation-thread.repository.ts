import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseRepository } from '../base.repository';
import {
  RequestNegotiationThread,
  RequestNegotiationThreadDocument,
} from '../../schemas/negotiation/request-negotiation-thread.schema';
import { RequestNegotiationThreadStatus } from '../../../common/types/negotiation/request-negotiation.types';

@Injectable()
export class RequestNegotiationThreadRepository extends BaseRepository<RequestNegotiationThread> {
  constructor(
    @InjectModel(RequestNegotiationThread.name)
    private readonly threadModel: Model<RequestNegotiationThread>,
  ) {
    super(threadModel);
  }

  findActiveByRequestId(requestId: string): Promise<RequestNegotiationThreadDocument | null> {
    return this.threadModel
      .findOne({
        requestId: new Types.ObjectId(requestId),
        status: RequestNegotiationThreadStatus.ACTIVE,
      })
      .exec();
  }

  findActiveById(threadId: string): Promise<RequestNegotiationThreadDocument | null> {
    if (!Types.ObjectId.isValid(threadId)) {
      return Promise.resolve(null);
    }
    return this.threadModel
      .findOne({
        _id: new Types.ObjectId(threadId),
        status: RequestNegotiationThreadStatus.ACTIVE,
      })
      .exec();
  }

  // Most recent thread for a request, regardless of status (history rendering).
  findLatestByRequestId(requestId: string): Promise<RequestNegotiationThreadDocument | null> {
    return this.threadModel
      .findOne({ requestId: new Types.ObjectId(requestId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  // Marks the active thread (if any) of a request as closed and returns it.
  // Used on final APPROVE/REJECT of the underlying request.
  async closeActiveByRequestId(
    requestId: string,
  ): Promise<RequestNegotiationThreadDocument | null> {
    return this.threadModel
      .findOneAndUpdate(
        {
          requestId: new Types.ObjectId(requestId),
          status: RequestNegotiationThreadStatus.ACTIVE,
        },
        { $set: { status: RequestNegotiationThreadStatus.CLOSED } },
        { new: true },
      )
      .exec();
  }

  async touchLastMessageAt(threadId: Types.ObjectId, at: Date): Promise<void> {
    await this.threadModel.updateOne({ _id: threadId }, { $set: { lastMessageAt: at } }).exec();
  }

  async registerInboundMessage(threadId: Types.ObjectId, at: Date): Promise<void> {
    await this.threadModel
      .updateOne({ _id: threadId }, { $set: { lastMessageAt: at }, $inc: { unreadForAdmin: 1 } })
      .exec();
  }

  async resetUnread(threadId: string): Promise<void> {
    await this.threadModel
      .updateOne({ _id: new Types.ObjectId(threadId) }, { $set: { unreadForAdmin: 0 } })
      .exec();
  }
}
