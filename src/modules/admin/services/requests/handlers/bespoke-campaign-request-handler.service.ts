import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientSession } from 'mongoose';
import { RequestForAdminRepository } from '../../../../../database/repositories/requests/request-for-admin.repository';
import { BespokeCampaignRepository } from '../../../../../database/repositories/campaigns/bespoke-campaign.repository';
import {
  AdminRequestResponseAction,
  RequestForAdminType,
  RequestLifecycleState,
  RequestSpecifiedStatus,
} from '../../../../../common/types/request-for-admin/request-for-admin.types';
import { CampaignConfirmationEnum } from '../../../../../common/types/client/campaign.types';
import { ObjId } from '../../../../../common/types/base.types';

export const BESPOKE_CAMPAIGN_REQUEST_HANDLER = Symbol('BESPOKE_CAMPAIGN_REQUEST_HANDLER');

export type RespondBespokeCampaignRequestProps = {
  requestId: string;
  response: AdminRequestResponseAction;
  bespokeCampaignRequestId: string;
};

@Injectable()
export class BespokeCampaignRequestHandler {
  constructor(
    private readonly requestRepository: RequestForAdminRepository,
    private readonly bespokeCampaignRepository: BespokeCampaignRepository,
  ) {}

  async exec({
    requestId,
    response,
    bespokeCampaignRequestId,
  }: RespondBespokeCampaignRequestProps): Promise<void> {
    switch (response) {
      case AdminRequestResponseAction.APPROVE:
        return this.accept(requestId, bespokeCampaignRequestId);
      case AdminRequestResponseAction.REJECT:
        return this.decline(requestId, bespokeCampaignRequestId);
      default:
        throw new BadRequestException('Unsupported response action for this request type.');
    }
  }

  private async accept(requestId: string, bespokeCampaignRequestId: string): Promise<void> {
    const exists = await this.bespokeCampaignRepository.findById(bespokeCampaignRequestId);
    if (!exists) throw new NotFoundException('Bespoke campaign request not found');

    const session = await this.bespokeCampaignRepository.startSession();
    session.startTransaction();

    try {
      await this.bespokeCampaignRepository.updateOne(
        { _id: new ObjId(bespokeCampaignRequestId) },
        { status: CampaignConfirmationEnum.accept },
        { session },
      );

      await this.closeRequest(requestId, RequestSpecifiedStatus.APPROVED, session);

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }

  private async decline(requestId: string, bespokeCampaignRequestId: string): Promise<void> {
    const exists = await this.bespokeCampaignRepository.findById(bespokeCampaignRequestId);
    if (!exists) throw new NotFoundException('Bespoke campaign request not found');

    const session = await this.bespokeCampaignRepository.startSession();
    session.startTransaction();

    try {
      await this.bespokeCampaignRepository.updateOne(
        { _id: new ObjId(bespokeCampaignRequestId) },
        { status: CampaignConfirmationEnum.decline },
        { session },
      );

      await this.closeRequest(requestId, RequestSpecifiedStatus.REJECTED, session);

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }

  private async closeRequest(
    requestId: string,
    status: RequestSpecifiedStatus,
    session: ClientSession,
  ): Promise<void> {
    await this.requestRepository.updateOne(
      {
        _id: new ObjId(requestId),
        type: RequestForAdminType.BESPOKE_CAMPAIGN_REQUEST,
        lifecycleStatus: RequestLifecycleState.OPEN,
      },
      {
        $set: {
          specifiedStatus: status,
          lifecycleStatus: RequestLifecycleState.CLOSED,
          reviewedAt: new Date(),
        },
      },
      { session },
    );
  }
}
