import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RequestForAdminRepository } from '../../../../database/repositories/requests/request-for-admin.repository';
import {
  AdminRequestResponseAction,
  IAdminRequest,
  RequestForAdminType,
} from '../../../../common/types/request-for-admin/request-for-admin.types';
import { NewClientAdminRequestDocument } from '../../../../database/schemas/requests/new-client-request.schema';
import { CampaignAdminRequestDocument } from '../../../../database/schemas/requests/campaign-request.schema';
import { BespokeCampaignAdminRequestDocument } from '../../../../database/schemas/requests/bespoke-campaign-admin-request.schema';
import {
  AdminRequestForListDto,
  AdminRequestsListResponseDto,
  AdminRequestsSearchResponseDto,
} from '../../dto/requests/admin-requests.dto';
import { SearchQueryDto } from '../../../../common/dto/requests/search-query.dto';
import { PaginationQueryDto } from '../../../../common/dto/requests/pagination-query.dto';
import {
  ADMIN_REQUEST_HANDLERS,
  AdminRequestHandlers,
} from './handlers/admin-request-handlers.service';
import {
  GET_ADMIN_REQUEST_DETAILS_SERVICE,
  GetAdminRequestDetailsService,
} from './get-admin-request-details.service';
import { AdminRequestMapper } from '../../../../common/mappers/admin-request.mapper';

const SUPPORTED_RESPONSE_ACTIONS = new Set<AdminRequestResponseAction>([
  AdminRequestResponseAction.APPROVE,
  AdminRequestResponseAction.REJECT,
]);

@Injectable()
export class AdminRequestsService {
  constructor(
    private readonly requestRepository: RequestForAdminRepository,
    @Inject(ADMIN_REQUEST_HANDLERS)
    private readonly handlers: AdminRequestHandlers,
    @Inject(GET_ADMIN_REQUEST_DETAILS_SERVICE)
    private readonly getAdminRequestDetailsService: GetAdminRequestDetailsService,
  ) {}

  async getRequestsList(query: PaginationQueryDto): Promise<AdminRequestsListResponseDto> {
    const list = await this.requestRepository.getPaginatedList(query);
    return {
      ...list,
      items: list.items.map(
        (i: IAdminRequest): AdminRequestForListDto => AdminRequestMapper.toDto(i),
      ),
    };
  }

  async searchRequests(query: SearchQueryDto): Promise<AdminRequestsSearchResponseDto> {
    const list = await this.requestRepository.search(query);
    return {
      ...list,
      page: 1,
      totalPages: 1,
      items: list.items.map(
        (i: IAdminRequest): AdminRequestForListDto => AdminRequestMapper.toDto(i),
      ),
    };
  }

  async getRequestDetails(requestId: string, requestType: RequestForAdminType): Promise<any> {
    const request = await this.getAdminRequestDetailsService.exec(requestId, requestType);

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    return request;
  }

  async respond(requestId: string, response: AdminRequestResponseAction): Promise<void> {
    if (!SUPPORTED_RESPONSE_ACTIONS.has(response)) {
      throw new BadRequestException('Invalid response action');
    }

    const request = await this.requestRepository.findById(requestId);

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    switch (request.type) {
      case RequestForAdminType.NEW_CLIENT_REQUEST: {
        const doc = request as unknown as NewClientAdminRequestDocument;
        await this.handlers.newClient.exec({
          requestId,
          response,
          clientId: doc.clientId.toString(),
        });
        break;
      }

      case RequestForAdminType.CAMPAIGN_REQUEST: {
        const doc = request as unknown as CampaignAdminRequestDocument;
        await this.handlers.campaign.exec({
          requestId,
          response,
          campaignId: doc.campaignId.toString(),
        });
        break;
      }

      case RequestForAdminType.BESPOKE_CAMPAIGN_REQUEST: {
        const doc = request as unknown as BespokeCampaignAdminRequestDocument;
        await this.handlers.bespokeCampaign.exec({
          requestId,
          response,
          bespokeCampaignRequestId: doc.bespokeCampaignRequestId.toString(),
        });
        break;
      }

      default:
        throw new BadRequestException(`Request type "${request.type}" is not supported.`);
    }
  }
}
