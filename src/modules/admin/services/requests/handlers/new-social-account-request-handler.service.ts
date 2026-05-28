import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClientSession } from 'mongoose';
import { RequestForAdminRepository } from '../../../../../database/repositories/requests/request-for-admin.repository';
import { InfluencerRepository } from '../../../../../database/repositories/users/influencer.repository';
import { EmailService } from '../../../../../integrations/email/email.service';
import {
  AdminRequestResponseAction,
  RequestForAdminType,
  RequestLifecycleState,
  RequestSpecifiedStatus,
} from '../../../../../common/types/request-for-admin/request-for-admin.types';
import { ObjId } from '../../../../../common/types/base.types';
import { AccountVerifiedStatus } from '../../../../../common/types/user.types';
import { SocialAccountLabelStatus } from '../../../../../common/types/influencer/influencer.types';
import { AdminToInfluencerEmails } from '../../../../../integrations/email/email.templates';
import { NewSocialAccountAdminRequestDocument } from '../../../../../database/schemas/requests/new-social-account-request.schema';

export const NEW_SOCIAL_ACCOUNT_REQUEST_HANDLER = Symbol('NEW_SOCIAL_ACCOUNT_REQUEST_HANDLER');

export type RespondNewSocialAccountRequestProps = {
  requestId: string;
  response: AdminRequestResponseAction;
  doc: NewSocialAccountAdminRequestDocument;
};

@Injectable()
export class NewSocialAccountRequestHandler {
  private readonly logger = new Logger(NewSocialAccountRequestHandler.name);

  constructor(
    private readonly requestRepository: RequestForAdminRepository,
    private readonly influencerRepository: InfluencerRepository,
    private readonly emailService: EmailService,
  ) {}

  async exec({ requestId, response, doc }: RespondNewSocialAccountRequestProps): Promise<void> {
    switch (response) {
      case AdminRequestResponseAction.APPROVE:
        return this.accept(requestId, doc);
      case AdminRequestResponseAction.REJECT:
        return this.decline(requestId, doc);
      default:
        throw new BadRequestException('Unsupported response action for this request type.');
    }
  }

  private async accept(
    requestId: string,
    doc: NewSocialAccountAdminRequestDocument,
  ): Promise<void> {
    const influencerId = doc.influencerId.toString();
    const accountId = doc.accountId.toString();
    const socialMedia = doc.socialMedia as string;

    const influencer = await this.influencerRepository.findById(influencerId, {
      select: ['firstName', 'email'],
    });
    if (!influencer) throw new NotFoundException('Influencer not found');

    const session = await this.influencerRepository.startSession();
    session.startTransaction();

    try {
      await this.influencerRepository.updateOne(
        {
          _id: new ObjId(influencerId),
          [`${socialMedia}._id`]: new ObjId(accountId),
        },
        {
          $set: {
            [`${socialMedia}.$.verifiedStatus`]: AccountVerifiedStatus.accept,
            [`${socialMedia}.$.labelStatus`]: SocialAccountLabelStatus.accept,
          },
        },
        { session },
      );

      await this.closeRequest(requestId, RequestSpecifiedStatus.APPROVED, session);

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
        AdminToInfluencerEmails.socialAccountApproved(influencer.email, {
          firstName: influencer.firstName ?? influencer.email,
        }),
      );
    } catch (err) {
      this.logger.warn(`Social account approved email failed for influencer ${influencerId}`, err);
    }
  }

  private async decline(
    requestId: string,
    doc: NewSocialAccountAdminRequestDocument,
  ): Promise<void> {
    const influencerId = doc.influencerId.toString();
    const accountId = doc.accountId.toString();
    const socialMedia = doc.socialMedia as string;

    const influencer = await this.influencerRepository.findById(influencerId, {
      select: ['firstName', 'email'],
    });
    if (!influencer) throw new NotFoundException('Influencer not found');

    const session = await this.influencerRepository.startSession();
    session.startTransaction();

    try {
      await this.influencerRepository.updateOne(
        {
          _id: new ObjId(influencerId),
          [`${socialMedia}._id`]: new ObjId(accountId),
        },
        {
          $set: {
            [`${socialMedia}.$.verifiedStatus`]: AccountVerifiedStatus.decline,
            [`${socialMedia}.$.labelStatus`]: SocialAccountLabelStatus.decline,
          },
        },
        { session },
      );

      await this.closeRequest(requestId, RequestSpecifiedStatus.REJECTED, session);

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
        AdminToInfluencerEmails.socialAccountDeclined(influencer.email, {
          firstName: influencer.firstName ?? influencer.email,
        }),
      );
    } catch (err) {
      this.logger.warn(`Social account declined email failed for influencer ${influencerId}`, err);
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
        type: RequestForAdminType.NEW_SOCIAL_ACCOUNT_REQUEST,
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
