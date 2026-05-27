import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClientSession } from 'mongoose';
import { RequestForAdminRepository } from '../../../../../database/repositories/requests/request-for-admin.repository';
import { InfluencerRepository } from '../../../../../database/repositories/users/influencer.repository';
import { ExchangeRateService } from '../../../../../integrations/exchange-rate/exchange-rate.service';
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
import { CurrencyCode } from '../../../../../common/types/finance.types';
import { AdminToInfluencerEmails } from '../../../../../integrations/email/email.templates';
import { PriceUpdateAdminRequestDocument } from '../../../../../database/schemas/requests/price-update-admin-request.schema';

export const PRICE_UPDATE_REQUEST_HANDLER = Symbol('PRICE_UPDATE_REQUEST_HANDLER');

export type RespondPriceUpdateRequestProps = {
  requestId: string;
  response: AdminRequestResponseAction;
  doc: PriceUpdateAdminRequestDocument;
};

@Injectable()
export class PriceUpdateRequestHandler {
  private readonly logger = new Logger(PriceUpdateRequestHandler.name);

  constructor(
    private readonly requestRepository: RequestForAdminRepository,
    private readonly influencerRepository: InfluencerRepository,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly emailService: EmailService,
  ) {}

  async exec({ requestId, response, doc }: RespondPriceUpdateRequestProps): Promise<void> {
    switch (response) {
      case AdminRequestResponseAction.APPROVE:
        return this.accept(requestId, doc);
      case AdminRequestResponseAction.REJECT:
        return this.decline(requestId, doc);
      default:
        throw new BadRequestException('Unsupported response action for this request type.');
    }
  }

  private async accept(requestId: string, doc: PriceUpdateAdminRequestDocument): Promise<void> {
    const influencerId = doc.influencerId.toString();
    const socialAccountId = doc.socialAccountId.toString();
    const socialMedia = doc.socialMedia as string;
    const newPrice = doc.newPrice;
    const currency = doc.currency as CurrencyCode;

    const influencer = await this.influencerRepository.findById(influencerId, {
      select: ['firstName', 'email'],
    });
    if (!influencer) throw new NotFoundException('Influencer not found');

    const exchangeRate =
      currency !== CurrencyCode.EUR ? await this.exchangeRateService.getRate(currency, 'EUR') : 1;

    const finalPrice = Math.round(newPrice * exchangeRate);
    const publicPrice = finalPrice * 2;

    const session = await this.influencerRepository.startSession();
    session.startTransaction();

    try {
      await this.influencerRepository.updateOne(
        {
          _id: new ObjId(influencerId),
          [`${socialMedia}._id`]: new ObjId(socialAccountId),
        },
        {
          $set: {
            [`${socialMedia}.$.price`]: finalPrice,
            [`${socialMedia}.$.publicPrice`]: publicPrice,
            [`${socialMedia}.$.initialPrice`]: newPrice,
            [`${socialMedia}.$.currency`]: currency,
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
        AdminToInfluencerEmails.priceChangeRequestApproved(influencer.email, {
          firstName: influencer.firstName ?? influencer.email,
        }),
      );
    } catch (err) {
      this.logger.warn(`Price approved email failed for influencer ${influencerId}`, err);
    }
  }

  private async decline(requestId: string, doc: PriceUpdateAdminRequestDocument): Promise<void> {
    const influencerId = doc.influencerId.toString();
    const socialAccountId = doc.socialAccountId.toString();
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
          [`${socialMedia}._id`]: new ObjId(socialAccountId),
        },
        {
          $set: {
            [`${socialMedia}.$.verifiedStatus`]: AccountVerifiedStatus.accept,
            [`${socialMedia}.$.labelStatus`]: SocialAccountLabelStatus.accept,
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
        AdminToInfluencerEmails.priceChangeRequestDeclined(influencer.email, {
          firstName: influencer.firstName ?? influencer.email,
        }),
      );
    } catch (err) {
      this.logger.warn(`Price declined email failed for influencer ${influencerId}`, err);
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
        type: RequestForAdminType.PRICE_UPDATE_REQUEST,
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
