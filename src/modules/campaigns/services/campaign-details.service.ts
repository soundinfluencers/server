import {Injectable, NotFoundException} from "@nestjs/common";
import {ClientRepository} from "../../../database/repositories/users/client.repository";
import {InfluencerRepository} from "../../../database/repositories/users/influencer.repository";
import {ICampaignDetails} from "../../../common/types/client/campaign.types";

export type CampaignDetailsContext<TCampaign, TResult> = {
    findCampaign: (campaignId: string) => Promise<TCampaign | null>;
    mapResult: (campaign: TCampaign) => TResult;
};

@Injectable()
export class CampaignDetailsService {
    constructor(
        private readonly clientRepo: ClientRepository,
        private readonly influencerRepo: InfluencerRepository,
    ) {}

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

    private async attachLogos<TCampaign extends ICampaignDetails>(
        campaign: TCampaign,
    ): Promise<TCampaign> {
        const influencerIds = [
            ...new Set(campaign.addedAccounts.map(acc => acc.influencerId.toString()))
        ];

        const influencers = await this.influencerRepo.findMany(
            { _id: { $in: influencerIds } },
            {
                lean: true,
                select: [
                    '_id',
                    'instagram._id', 'instagram.logoUrl',
                    'tiktok._id', 'tiktok.logoUrl',
                    'youtube._id', 'youtube.logoUrl',
                    'facebook._id', 'facebook.logoUrl',
                    'spotify._id', 'spotify.logoUrl',
                    'soundcloud._id', 'soundcloud.logoUrl',
                    'press._id', 'press.logoUrl',
                ],
            },
        );

        const influencerMap = new Map(
            influencers.map(inf => [inf._id.toString(), inf]),
        );

        campaign.addedAccounts = campaign.addedAccounts.map(acc => {
            const influencer = influencerMap.get(acc.influencerId.toString());
            if (!influencer) return acc;

            const accountsArray = influencer[acc.socialMedia] ?? [];
            const matchedAccount = accountsArray.find(
                a => a._id?.toString() === acc.addedAccountsId?.toString(),
            );

            return {
                ...acc,
                logoUrl: matchedAccount?.logoUrl ?? null,
            };
        });

        return campaign;
    }
}