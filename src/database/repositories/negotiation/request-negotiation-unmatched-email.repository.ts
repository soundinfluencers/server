import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../base.repository';
import {
  RequestNegotiationUnmatchedEmail,
  RequestNegotiationUnmatchedEmailDocument,
} from '../../schemas/negotiation/request-negotiation-unmatched-email.schema';

@Injectable()
export class RequestNegotiationUnmatchedEmailRepository extends BaseRepository<RequestNegotiationUnmatchedEmail> {
  constructor(
    @InjectModel(RequestNegotiationUnmatchedEmail.name)
    private readonly unmatchedEmailModel: Model<RequestNegotiationUnmatchedEmail>,
  ) {
    super(unmatchedEmailModel);
  }

  async insertIfNew(
    data: Partial<RequestNegotiationUnmatchedEmail>,
  ): Promise<RequestNegotiationUnmatchedEmailDocument | null> {
    try {
      return await this.unmatchedEmailModel.create(data);
    } catch (err: any) {
      if (err?.code === 11000) {
        return null;
      }
      throw err;
    }
  }
}
