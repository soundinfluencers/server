import { Inject, Injectable } from '@nestjs/common';
import { NEW_CLIENT_REQUEST_HANDLER, NewClientRequestHandler } from './new-client-request.handler';
import {
  CAMPAIGN_REQUEST_HANDLER,
  CampaignRequestHandler,
} from './campaign-request-handler.service';
import {
  BESPOKE_CAMPAIGN_REQUEST_HANDLER,
  BespokeCampaignRequestHandler,
} from './bespoke-campaign-request-handler.service';

export const ADMIN_REQUEST_HANDLERS = Symbol('ADMIN_REQUEST_HANDLERS');

@Injectable()
export class AdminRequestHandlers {
  constructor(
    @Inject(NEW_CLIENT_REQUEST_HANDLER)
    readonly newClient: NewClientRequestHandler,
    @Inject(CAMPAIGN_REQUEST_HANDLER)
    readonly campaign: CampaignRequestHandler,
    @Inject(BESPOKE_CAMPAIGN_REQUEST_HANDLER)
    readonly bespokeCampaign: BespokeCampaignRequestHandler,
  ) {}
}
