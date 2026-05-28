import { Injectable } from '@nestjs/common';
import { RequestForAdminRepository } from '../../../../database/repositories/requests/request-for-admin.repository';
import {
  BespokeCampaignRequestDetailsDto,
  CampaignRequestDetailsDto,
  NewClientRequestDetailsDto,
  NewInfluencerRequestDetailsDto,
  NewSocialAccountRequestDetailsDto,
  PriceUpdateRequestDetailsDto,
} from '../../dto/requests/admin-requests.dto';
import { RequestForAdminType } from '../../../../common/types/request-for-admin/request-for-admin.types';
import { AdminRequestMapper } from '../../../../common/mappers/admin-request.mapper';

export const GET_ADMIN_REQUEST_DETAILS_SERVICE = Symbol('GET_ADMIN_REQUEST_DETAILS_SERVICE');

@Injectable()
export class GetAdminRequestDetailsService {
  constructor(private readonly requestRepository: RequestForAdminRepository) {}

  async exec(
    requestId: string,
    requestType: RequestForAdminType,
  ): Promise<
    | NewClientRequestDetailsDto
    | CampaignRequestDetailsDto
    | BespokeCampaignRequestDetailsDto
    | NewInfluencerRequestDetailsDto
    | PriceUpdateRequestDetailsDto
    | NewSocialAccountRequestDetailsDto
    | null
  > {
    switch (requestType) {
      case RequestForAdminType.NEW_CLIENT_REQUEST: {
        const details = await this.requestRepository.getNewClientRequestDetails(requestId);
        return details ? AdminRequestMapper.toNewClientRequestDetailsDto(details) : null;
      }
      case RequestForAdminType.CAMPAIGN_REQUEST: {
        const details = await this.requestRepository.getCampaignRequestDetails(requestId);
        return details ? AdminRequestMapper.toCampaignRequestDetailsDto(details) : null;
      }
      case RequestForAdminType.BESPOKE_CAMPAIGN_REQUEST: {
        const details = await this.requestRepository.getBespokeCampaignRequestDetails(requestId);
        return details ? AdminRequestMapper.toBespokeCampaignRequestDetailsDto(details) : null;
      }
      case RequestForAdminType.NEW_INFLUENCER_REQUEST: {
        const details = await this.requestRepository.getNewInfluencerRequestDetails(requestId);
        return details ? AdminRequestMapper.toNewInfluencerRequestDetailsDto(details) : null;
      }
      case RequestForAdminType.PRICE_UPDATE_REQUEST: {
        const details = await this.requestRepository.getPriceUpdateRequestDetails(requestId);
        return details ? AdminRequestMapper.toPriceUpdateRequestDetailsDto(details) : null;
      }
      case RequestForAdminType.NEW_SOCIAL_ACCOUNT_REQUEST: {
        const details = await this.requestRepository.getNewSocialAccountRequestDetails(requestId);
        return details ? AdminRequestMapper.toNewSocialAccountRequestDetailsDto(details) : null;
      }
      default:
        return null;
    }
  }
}
