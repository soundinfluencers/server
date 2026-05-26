import { Injectable } from '@nestjs/common';
import { RequestForAdminRepository } from '../../../../database/repositories/requests/request-for-admin.repository';
import {
  CampaignRequestDetailsDto,
  NewClientRequestDetailsDto,
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
  ): Promise<NewClientRequestDetailsDto | CampaignRequestDetailsDto | null> {
    switch (requestType) {
      case RequestForAdminType.NEW_CLIENT_REQUEST: {
        const details = await this.requestRepository.getNewClientRequestDetails(requestId);
        return details ? AdminRequestMapper.toNewClientRequestDetailsDto(details) : null;
      }
      case RequestForAdminType.CAMPAIGN_REQUEST: {
        const details = await this.requestRepository.getCampaignRequestDetails(requestId);
        return details ? AdminRequestMapper.toCampaignRequestDetailsDto(details) : null;
      }
      default:
        return null;
    }
  }
}
