import { BadRequestException, Injectable } from '@nestjs/common';
import { RequestForAdminRepository } from '../../../../database/repositories/requests/request-for-admin.repository';
import {
  CreateBespokeCampaignRequestProps,
  CreateCampaignRequestProps,
  CreateNewClientRequestProps,
  CreateNewInfluencerRequestProps,
  CreatePriceUpdateRequestProps,
  RequestForAdminType,
  RequestGroup,
  RequestLifecycleState,
  RequestSpecifiedStatus,
} from '../../../../common/types/request-for-admin/request-for-admin.types';
import { ClientSession } from 'mongoose';
import { ObjId } from '../../../../common/types/base.types';
import { Role } from '../../../../common/types/user.types';

export const CREATE_ADMIN_REQUEST_SERVICE = Symbol('CREATE_ADMIN_REQUEST_SERVICE');

type CreateAdminRequestProps =
  | {
      requestType: RequestForAdminType.NEW_CLIENT_REQUEST;
      session?: ClientSession;
      payload: CreateNewClientRequestProps;
    }
  | {
      requestType: RequestForAdminType.CAMPAIGN_REQUEST;
      session?: ClientSession;
      payload: CreateCampaignRequestProps;
    }
  | {
      requestType: RequestForAdminType.BESPOKE_CAMPAIGN_REQUEST;
      session?: ClientSession;
      payload: CreateBespokeCampaignRequestProps;
    }
  | {
      requestType: RequestForAdminType.NEW_INFLUENCER_REQUEST;
      session?: ClientSession;
      payload: CreateNewInfluencerRequestProps;
    }
  | {
      requestType: RequestForAdminType.PRICE_UPDATE_REQUEST;
      session?: ClientSession;
      payload: CreatePriceUpdateRequestProps;
    };

@Injectable()
export class CreateAdminRequestService {
  constructor(private readonly requestRepository: RequestForAdminRepository) {}

  async exec(props: CreateAdminRequestProps): Promise<void> {
    switch (props.requestType) {
      case RequestForAdminType.NEW_CLIENT_REQUEST: {
        if (!props.payload.clientId) {
          throw new BadRequestException(`clientId is required for ${props.requestType}`);
        }
        await this.createClientRequest(props.payload, props.session);
        break;
      }

      case RequestForAdminType.CAMPAIGN_REQUEST: {
        if (!props.payload.clientId || !props.payload.campaignId) {
          throw new BadRequestException(
            `clientId and campaignId are required for ${props.requestType}`,
          );
        }
        await this.createCampaignRequest(props.payload, props.session);
        break;
      }

      case RequestForAdminType.BESPOKE_CAMPAIGN_REQUEST: {
        if (!props.payload.clientId || !props.payload.bespokeCampaignRequestId) {
          throw new BadRequestException(
            `clientId and bespokeCampaignRequestId are required for ${props.requestType}`,
          );
        }
        await this.createBespokeCampaignRequest(props.payload, props.session);
        break;
      }

      case RequestForAdminType.NEW_INFLUENCER_REQUEST: {
        if (!props.payload.influencerId) {
          throw new BadRequestException(`influencerId is required for ${props.requestType}`);
        }
        await this.createInfluencerRequest(props.payload, props.session);
        break;
      }

      case RequestForAdminType.PRICE_UPDATE_REQUEST: {
        if (!props.payload.influencerId || !props.payload.socialAccountId) {
          throw new BadRequestException(
            `influencerId and socialAccountId are required for ${props.requestType}`,
          );
        }
        await this.createPriceUpdateRequest(props.payload, props.session);
        break;
      }

      default: {
        throw new BadRequestException(`Request type is not supported.`);
      }
    }
  }

  private async createClientRequest(
    props: CreateNewClientRequestProps,
    session?: ClientSession,
  ): Promise<void> {
    await this.requestRepository.create(
      {
        group: RequestGroup.CLIENT,
        type: RequestForAdminType.NEW_CLIENT_REQUEST,
        lifecycleStatus: RequestLifecycleState.OPEN,
        specifiedStatus: RequestSpecifiedStatus.WAITING_FOR_ADMIN,
        userFirstName: props.clientName,
        userRole: Role.client,
        clientId: new ObjId(props.clientId),
      },
      { session },
    );
  }

  private async createCampaignRequest(
    props: CreateCampaignRequestProps,
    session?: ClientSession,
  ): Promise<void> {
    await this.requestRepository.create(
      {
        group: RequestGroup.CAMPAIGN,
        type: RequestForAdminType.CAMPAIGN_REQUEST,
        lifecycleStatus: RequestLifecycleState.OPEN,
        specifiedStatus: RequestSpecifiedStatus.WAITING_FOR_ADMIN,
        userFirstName: props.clientName,
        userRole: Role.client,
        clientId: new ObjId(props.clientId),
        campaignId: new ObjId(props.campaignId),
      },
      { session },
    );
  }

  private async createBespokeCampaignRequest(
    props: CreateBespokeCampaignRequestProps,
    session?: ClientSession,
  ): Promise<void> {
    await this.requestRepository.create(
      {
        group: RequestGroup.CLIENT,
        type: RequestForAdminType.BESPOKE_CAMPAIGN_REQUEST,
        lifecycleStatus: RequestLifecycleState.OPEN,
        specifiedStatus: RequestSpecifiedStatus.WAITING_FOR_ADMIN,
        userFirstName: props.clientName,
        userRole: Role.client,
        clientId: new ObjId(props.clientId),
        bespokeCampaignRequestId: new ObjId(props.bespokeCampaignRequestId),
      },
      { session },
    );
  }

  private async createInfluencerRequest(
    props: CreateNewInfluencerRequestProps,
    session?: ClientSession,
  ): Promise<void> {
    await this.requestRepository.create(
      {
        group: RequestGroup.INFLUENCER,
        type: RequestForAdminType.NEW_INFLUENCER_REQUEST,
        lifecycleStatus: RequestLifecycleState.OPEN,
        specifiedStatus: RequestSpecifiedStatus.WAITING_FOR_ADMIN,
        userFirstName: props.influencerName,
        userRole: Role.influencer,
        influencerId: new ObjId(props.influencerId),
      },
      { session },
    );
  }

  private async createPriceUpdateRequest(
    props: CreatePriceUpdateRequestProps,
    session?: ClientSession,
  ): Promise<void> {
    await this.requestRepository.create(
      {
        group: RequestGroup.PRICING,
        type: RequestForAdminType.PRICE_UPDATE_REQUEST,
        lifecycleStatus: RequestLifecycleState.OPEN,
        specifiedStatus: RequestSpecifiedStatus.WAITING_FOR_ADMIN,
        userFirstName: props.influencerName,
        userRole: Role.influencer,
        influencerId: new ObjId(props.influencerId),
        socialAccountId: new ObjId(props.socialAccountId),
        socialMedia: props.socialMedia,
        newPrice: props.newPrice,
        currency: props.currency,
      },
      { session },
    );
  }
}
