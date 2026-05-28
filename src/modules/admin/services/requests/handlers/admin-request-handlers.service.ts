import { Inject, Injectable } from '@nestjs/common';
import { NEW_CLIENT_REQUEST_HANDLER, NewClientRequestHandler } from './new-client-request.handler';
import { CAMPAIGN_REQUEST_HANDLER, CampaignRequestHandler } from './campaign-request.handler';
import {
  BESPOKE_CAMPAIGN_REQUEST_HANDLER,
  BespokeCampaignRequestHandler,
} from './bespoke-campaign-request.handler';
import {
  NEW_INFLUENCER_REQUEST_HANDLER,
  NewInfluencerRequestHandler,
} from './new-influencer-request.handler';
import {
  PRICE_UPDATE_REQUEST_HANDLER,
  PriceUpdateRequestHandler,
} from './price-update-request-handler.service';
import {
  NEW_SOCIAL_ACCOUNT_REQUEST_HANDLER,
  NewSocialAccountRequestHandler,
} from './new-social-account-request-handler.service';

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
    @Inject(NEW_INFLUENCER_REQUEST_HANDLER)
    readonly newInfluencer: NewInfluencerRequestHandler,
    @Inject(PRICE_UPDATE_REQUEST_HANDLER)
    readonly priceUpdate: PriceUpdateRequestHandler,
    @Inject(NEW_SOCIAL_ACCOUNT_REQUEST_HANDLER)
    readonly newSocialAccount: NewSocialAccountRequestHandler,
  ) {}
}
