import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { RequestForAdminRepository } from '../../../../../database/repositories/requests/request-for-admin.repository';
import {
  AdminRequestResponseAction,
  RequestForAdminType,
  RequestLifecycleState,
  RequestSpecifiedStatus,
} from '../../../../../common/types/request-for-admin/request-for-admin.types';
import { InfluencerRepository } from '../../../../../database/repositories/users/influencer.repository';
import { ObjId } from '../../../../../common/types/base.types';
import { AccountVerifiedStatus } from '../../../../../common/types/user.types';
import { EmailService } from '../../../../../integrations/email/email.service';
import { AdminToInfluencerEmails } from '../../../../../integrations/email/email.templates';
import { SocialMediaEnum } from '../../../../../common/types/social-media.types';
import { SocialAccountLabelStatus } from '../../../../../common/types/influencer/influencer.types';

export const NEW_INFLUENCER_REQUEST_HANDLER = Symbol('NEW_INFLUENCER_REQUEST_HANDLER');

export type RespondNewInfluencerRequestProps = {
  requestId: string;
  response: AdminRequestResponseAction;
  influencerId: string;
};

@Injectable()
export class NewInfluencerRequestHandler {
  private readonly logger = new Logger(NewInfluencerRequestHandler.name);

  constructor(
    private readonly requestRepository: RequestForAdminRepository,
    private readonly influencerRepository: InfluencerRepository,
    private readonly emailService: EmailService,
  ) {}

  async exec({
    requestId,
    response,
    influencerId,
  }: RespondNewInfluencerRequestProps): Promise<void> {
    switch (response) {
      case AdminRequestResponseAction.APPROVE:
        return this.accept(requestId, influencerId);
      case AdminRequestResponseAction.REJECT:
        return this.decline(requestId, influencerId);
      default:
        throw new BadRequestException('Unsupported response action for this request type.');
    }
  }

  private async accept(requestId: string, influencerId: string): Promise<void> {
    const influencer = await this.influencerRepository.findById(influencerId, {
      select: ['firstName', 'email'],
    });

    if (!influencer) {
      throw new BadRequestException('Influencer not found');
    }

    const statusUpdate = Object.fromEntries(
      Object.values(SocialMediaEnum).flatMap((f) => [
        [`${f}.$[].verifiedStatus`, AccountVerifiedStatus.waitForUser],
        [`${f}.$[].labelStatus`, SocialAccountLabelStatus.waitForUser],
      ]),
    );

    const session = await this.influencerRepository.startSession();
    session.startTransaction();

    try {
      await this.influencerRepository.updateOne(
        { _id: new ObjId(influencerId) },
        {
          $set: {
            verifiedStatus: AccountVerifiedStatus.waitForUser,
            ...statusUpdate,
          },
        },
        { session },
      );

      await this.requestRepository.updateOne(
        {
          _id: new ObjId(requestId),
          type: RequestForAdminType.NEW_INFLUENCER_REQUEST,
          lifecycleStatus: RequestLifecycleState.OPEN,
          specifiedStatus: {
            $in: [RequestSpecifiedStatus.WAITING_FOR_ADMIN, RequestSpecifiedStatus.NEGOTIATION],
          },
        },
        {
          $set: {
            specifiedStatus: RequestSpecifiedStatus.APPROVED,
            lifecycleStatus: RequestLifecycleState.CLOSED,
            reviewedAt: new Date(),
          },
        },
        { session },
      );

      await session.commitTransaction();
    } catch (err) {
      this.logger.error(err);
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }

    try {
      await this.emailService.send(
        AdminToInfluencerEmails.influencerApproved(influencer.email, {
          firstName: influencer.firstName ?? influencer.email,
        }),
      );
    } catch (err) {
      this.logger.warn(`Approval email failed for influencer ${influencerId}`, err);
    }
  }

  private async decline(requestId: string, influencerId: string): Promise<void> {
    const influencer = await this.influencerRepository.findById(influencerId, {
      select: ['firstName', 'email'],
    });

    if (!influencer) {
      throw new BadRequestException('Influencer not found');
    }

    const statusUpdate = Object.fromEntries(
      Object.values(SocialMediaEnum).flatMap((f) => [
        [`${f}.$[].verifiedStatus`, AccountVerifiedStatus.decline],
        [`${f}.$[].labelStatus`, SocialAccountLabelStatus.decline],
      ]),
    );

    const session = await this.influencerRepository.startSession();
    session.startTransaction();

    try {
      await this.influencerRepository.updateOne(
        { _id: new ObjId(influencerId) },
        {
          $set: {
            verifiedStatus: AccountVerifiedStatus.decline,
            ...statusUpdate,
          },
        },
        { session },
      );

      await this.requestRepository.updateOne(
        {
          _id: new ObjId(requestId),
          type: RequestForAdminType.NEW_INFLUENCER_REQUEST,
          lifecycleStatus: RequestLifecycleState.OPEN,
          specifiedStatus: {
            $in: [RequestSpecifiedStatus.WAITING_FOR_ADMIN, RequestSpecifiedStatus.NEGOTIATION],
          },
        },
        {
          $set: {
            specifiedStatus: RequestSpecifiedStatus.REJECTED,
            lifecycleStatus: RequestLifecycleState.CLOSED,
            reviewedAt: new Date(),
          },
        },
        { session },
      );

      await session.commitTransaction();
    } catch (err) {
      this.logger.error(err);
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }

    try {
      await this.emailService.send(
        AdminToInfluencerEmails.influencerDeclined(influencer.email, {
          firstName: influencer.firstName ?? influencer.email,
        }),
      );
    } catch (err) {
      this.logger.warn(`Decline email failed for influencer ${influencerId}`, err);
    }
  }
}
