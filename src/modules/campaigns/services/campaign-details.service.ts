import { Injectable, NotFoundException } from '@nestjs/common';
import { InfluencerRepository } from '../../../database/repositories/users/influencer.repository';
import { ICampaignDetails } from '../../../common/types/client/campaign.types';
import { CurrencyCode } from '../../../common/types/finance.types';

export type CampaignDetailsContext<TCampaign, TResult> = {
  findCampaign: (campaignId: string) => Promise<TCampaign | null>;
  mapResult: (campaign: TCampaign) => TResult;
};

@Injectable()
export class CampaignDetailsService {
  constructor(private readonly influencerRepo: InfluencerRepository) {}

  async execute<TCampaign extends ICampaignDetails, TResult>(
    campaignId: string,
    context: CampaignDetailsContext<TCampaign, TResult>,
  ): Promise<TResult> {
    let campaign = await context.findCampaign(campaignId);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    campaign = await this.attachLogos(campaign);

    return context.mapResult(campaign);
  }

  async attachLogos<TCampaign extends ICampaignDetails>(campaign: TCampaign): Promise<TCampaign> {
    const influencerIds = [...new Set(campaign.addedAccounts.map((acc) => acc.influencerId))];

    const socialMedias = [
      'instagram',
      'tiktok',
      'youtube',
      'facebook',
      'spotify',
      'soundcloud',
      'press',
    ] as const;

    const socialAccountFields = [
      '_id',
      'logoUrl',
      'profileCategory',
      'currency',
      'initialPrice',
    ] as const;

    const select = [
      '_id',
      'phone',
      ...socialMedias.flatMap((socialMedia) =>
        socialAccountFields.map((field) => `${socialMedia}.${field}`),
      ),
    ];

    const influencers = await this.influencerRepo.findMany(
      { _id: { $in: influencerIds } },
      {
        lean: true,
        select,
      },
    );

    const influencerMap = new Map(influencers.map((inf) => [inf._id?.toString(), inf]));

    campaign.addedAccounts = campaign.addedAccounts.map((acc) => {
      const influencer = influencerMap.get(acc.influencerId?.toString());
      if (!influencer) return acc;

      const accountsArray = influencer[acc.socialMedia] ?? [];
      const matchedAccount = accountsArray?.find(
        (a) => a._id?.toString() === acc.socialAccountId?.toString(),
      );

      return {
        ...acc,
        logoUrl: matchedAccount?.logoUrl ?? null,
        profileType: matchedAccount?.profileCategory ?? null,
        initialPrice: matchedAccount?.initialPrice ?? null,
        currency: matchedAccount?.currency ?? CurrencyCode.EUR,
        phoneNumber: influencer.phone,
      };
    });

    return campaign;
  }
}
