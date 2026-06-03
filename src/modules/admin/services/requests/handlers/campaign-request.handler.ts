import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClientSession } from 'mongoose';
import { RequestForAdminRepository } from '../../../../../database/repositories/requests/request-for-admin.repository';
import { ClientRepository } from '../../../../../database/repositories/users/client.repository';
import { CampaignRepository } from '../../../../../database/repositories/campaigns/campaign.repository';
import { InfluencerRepository } from '../../../../../database/repositories/users/influencer.repository';
import { InfluencerActionsHistoryService } from '../../../../influencer-actions-history/influencer-actions-history.service';
import { EmailService } from '../../../../../integrations/email/email.service';
import {
  AdminRequestResponseAction,
  RequestForAdminType,
  RequestLifecycleState,
  RequestSpecifiedStatus,
} from '../../../../../common/types/request-for-admin/request-for-admin.types';
import { ObjId } from '../../../../../common/types/base.types';
import {
  CampaignConfirmationEnum,
  CampaignStatusEnum,
} from '../../../../../common/types/client/campaign.types';
import { SocialMediaEnum } from '../../../../../common/types/social-media.types';
import {
  AdminToClientEmails,
  AdminToInfluencerEmails,
} from '../../../../../integrations/email/email.templates';
import { AccountObjectForCreateNewPromoRequestMessage } from '../../../../../integrations/email/dto/templates/campaign-email.dto';

export const CAMPAIGN_REQUEST_HANDLER = Symbol('CAMPAIGN_REQUEST_HANDLER');

export type RespondCampaignRequestProps = {
  requestId: string;
  response: AdminRequestResponseAction;
  campaignId: string;
};

@Injectable()
export class CampaignRequestHandler {
  private readonly logger = new Logger(CampaignRequestHandler.name);

  constructor(
    private readonly requestRepository: RequestForAdminRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly clientRepository: ClientRepository,
    private readonly influencerRepository: InfluencerRepository,
    private readonly influencerActionsHistoryService: InfluencerActionsHistoryService,
    private readonly emailService: EmailService,
  ) {}

  async exec({ requestId, response, campaignId }: RespondCampaignRequestProps): Promise<void> {
    switch (response) {
      case AdminRequestResponseAction.APPROVE:
        return this.accept(requestId, campaignId);
      case AdminRequestResponseAction.REJECT:
        return this.decline(requestId, campaignId);
      default:
        throw new BadRequestException('Unsupported response action for this request type.');
    }
  }

  private async accept(requestId: string, campaignId: string): Promise<void> {
    const campaign = await this.campaignRepository.findById(campaignId, { lean: true });
    if (!campaign) throw new NotFoundException('Campaign not found');

    if (campaign.statusCampaign !== CampaignStatusEnum.underReview) {
      throw new BadRequestException('Campaign is not under review and cannot be accepted');
    }

    const client = await this.clientRepository.findById(campaign.clientId.toString(), {
      select: ['firstName', 'email'],
    });
    if (!client) throw new NotFoundException('Client not found');

    const influencerIds = campaign.addedAccounts.map((acc) => acc.influencerId);
    const influencers = await this.influencerRepository.findMany({ _id: { $in: influencerIds } });

    const influencerEmailPayloads: Array<{
      firstName: string;
      email: string;
      accountsAndDetails: AccountObjectForCreateNewPromoRequestMessage[];
    }> = [];

    const session = await this.campaignRepository.startSession();
    session.startTransaction();

    try {
      for (const influencer of influencers) {
        for (const socialMedia of Object.values(SocialMediaEnum)) {
          const accounts: any[] = influencer[socialMedia] ?? [];

          for (const account of accounts) {
            const isInCampaign = campaign.addedAccounts.some(
              (acc) =>
                (acc.username === account.username ||
                  (acc as any).instagramUsername === account.username) &&
                acc.socialMedia === socialMedia,
            );
            if (!isInCampaign) continue;

            await this.influencerActionsHistoryService.upsertInfluencerCampaignActionsHistory(
              {
                influencerId: influencer._id.toString(),
                campaignId,
                campaignName: campaign.campaignName,
                updatedCampaignAction: {
                  addedAccountsId: account._id,
                  socialAccountId: account._id,
                  actionNumber: 0,
                  networkUsername: account.username,
                  rewardForInfluencer: account.price,
                  socialMedia,
                },
              },
              session,
            );
          }
        }

        const influencerAccounts = campaign.addedAccounts.filter(
          (acc) => acc.influencerId.toString() === influencer._id.toString(),
        );

        const accountDetails: AccountObjectForCreateNewPromoRequestMessage[] =
          influencerAccounts.map((acc) => {
            const content = campaign.campaignContent.find(
              (c) => c._id.toString() === acc.selectedContent?.campaignContentItemId?.toString(),
            );
            return {
              pageName: acc.username,
              reward: `${acc.price}€`,
              socialMedia: acc.socialMedia,
              mainLink: content?.mainLink ?? '',
              description:
                content?.descriptions?.find(
                  (d) => d._id.toString() === acc.selectedContent?.descriptionId?.toString(),
                )?.description ?? '',
              taggedUser: content?.taggedUser,
              taggedLink: content?.taggedLink,
              additionalBrief: content?.additionalBrief,
            };
          });

        if (accountDetails.length > 0) {
          influencerEmailPayloads.push({
            firstName: influencer.firstName,
            email: influencer.email,
            accountsAndDetails: accountDetails,
          });
        }
      }

      await this.campaignRepository.updateOne(
        { _id: new ObjId(campaignId) },
        {
          verifyCampaign: CampaignConfirmationEnum.accept,
          statusCampaign: CampaignStatusEnum.distributing,
        },
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

    for (const payload of influencerEmailPayloads) {
      try {
        await this.emailService.send(AdminToInfluencerEmails.newPromoRequest(payload));
      } catch (err) {
        this.logger.warn(
          `New promo email failed for influencer ${payload.email} on campaign ${campaignId}`,
          err,
        );
      }
    }

    try {
      await this.emailService.send(
        AdminToClientEmails.approvedCampaign(client.email, {
          firstName: client.firstName ?? client.email,
        }),
      );
    } catch (err) {
      this.logger.warn(`Approval email to client failed for campaign ${campaignId}`, err);
    }
  }

  private async decline(requestId: string, campaignId: string): Promise<void> {
    const campaign = await this.campaignRepository.findById(campaignId, { lean: true });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const client = await this.clientRepository.findById(campaign.clientId.toString(), {
      select: ['firstName', 'email'],
    });
    if (!client) throw new NotFoundException('Client not found');

    const session = await this.campaignRepository.startSession();
    session.startTransaction();

    try {
      await this.campaignRepository.updateOne(
        { _id: new ObjId(campaignId) },
        {
          verifyCampaign: CampaignConfirmationEnum.decline,
          statusCampaign: CampaignStatusEnum.declined,
        },
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

    try {
      await this.emailService.send(
        AdminToClientEmails.declinedCampaign(client.email, {
          firstName: client.firstName ?? client.email,
        }),
      );
    } catch (err) {
      this.logger.warn(`Decline email to client failed for campaign ${campaignId}`, err);
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
        type: RequestForAdminType.CAMPAIGN_REQUEST,
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
