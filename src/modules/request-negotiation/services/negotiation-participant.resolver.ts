import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RequestForAdminRepository } from '../../../database/repositories/requests/request-for-admin.repository';
import { RequestForAdminType } from '../../../common/types/request-for-admin/request-for-admin.types';
import { NegotiationParticipant } from '../../../common/types/negotiation/request-negotiation.types';

// Shape shared by every request-detail projection we rely on.
type ResolvableDetails = {
  email?: string;
  firstName?: string;
  lastName?: string;
  userFirstName?: string;
} | null;

@Injectable()
export class NegotiationParticipantResolver {
  constructor(private readonly requestRepository: RequestForAdminRepository) {}

  // Resolves the counterparty (client or influencer) email + display name for a
  // given request, regardless of request type.
  async resolve(requestId: string, type: RequestForAdminType): Promise<NegotiationParticipant> {
    const details = await this.loadDetails(requestId, type);

    if (!details?.email) {
      throw new NotFoundException('Cannot resolve participant email for this request');
    }

    return { email: details.email, name: this.buildName(details) };
  }

  private loadDetails(requestId: string, type: RequestForAdminType): Promise<ResolvableDetails> {
    switch (type) {
      case RequestForAdminType.NEW_CLIENT_REQUEST:
        return this.requestRepository.getNewClientRequestDetails(requestId);
      case RequestForAdminType.CAMPAIGN_REQUEST:
        return this.requestRepository.getCampaignRequestDetails(requestId);
      case RequestForAdminType.BESPOKE_CAMPAIGN_REQUEST:
        return this.requestRepository.getBespokeCampaignRequestDetails(requestId);
      case RequestForAdminType.NEW_INFLUENCER_REQUEST:
        return this.requestRepository.getNewInfluencerRequestDetails(requestId);
      case RequestForAdminType.PRICE_UPDATE_REQUEST:
        return this.requestRepository.getPriceUpdateRequestDetails(requestId);
      case RequestForAdminType.NEW_SOCIAL_ACCOUNT_REQUEST:
        return this.requestRepository.getNewSocialAccountRequestDetails(requestId);
      default:
        throw new BadRequestException(`Negotiation is not supported for request type "${type}"`);
    }
  }

  private buildName(details: NonNullable<ResolvableDetails>): string {
    const first = details.firstName ?? details.userFirstName ?? '';
    const last = details.lastName ?? '';
    return [first, last].filter(Boolean).join(' ').trim() || details.email!;
  }
}
