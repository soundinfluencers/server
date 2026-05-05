import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { InfluencerRepository } from '../../../database/repositories/users/influencer.repository';

// ─── structural constraints (mirrors CampaignDetailsService pattern) ───────

export type ProposalAccountDetailsLike = {
    influencerId: Types.ObjectId;
    accountId: Types.ObjectId;
    socialMedia: string;
};

export type ProposalOptionDetailsLike = {
    addedAccounts: ProposalAccountDetailsLike[];
};

// ─── context ───────────────────────────────────────────────────────────────

export type ProposalCampaignDetailsContext<
    TCampaign extends { _id: Types.ObjectId },
    TOption extends ProposalOptionDetailsLike,
    TResult,
> = {
    findCampaign: (campaignId: string) => Promise<TCampaign | null>;
    findOption: (campaignId: Types.ObjectId, optionIndex: number) => Promise<TOption | null>;
    mapResult: (campaign: TCampaign, option: TOption) => TResult;
};

// ─── service ───────────────────────────────────────────────────────────────

@Injectable()
export class ProposalCampaignDetailsService {
    constructor(
        private readonly influencerRepo: InfluencerRepository,
    ) {}

    async execute<
        TCampaign extends { _id: Types.ObjectId },
        TOption extends ProposalOptionDetailsLike,
        TResult,
    >(
        campaignId: string,
        optionIndex: number,
        context: ProposalCampaignDetailsContext<TCampaign, TOption, TResult>,
    ): Promise<TResult> {
        const campaign = await context.findCampaign(campaignId);

        if (!campaign) {
            throw new NotFoundException('Proposal campaign not found');
        }

        const option = await context.findOption(campaign._id, optionIndex);

        if (!option) {
            throw new NotFoundException('Proposal campaign option not found');
        }

        await this.attachLogos(option);

        return context.mapResult(campaign, option);
    }

    private async attachLogos<TOption extends ProposalOptionDetailsLike>(
        option: TOption,
    ): Promise<void> {
        const influencerIds = [
            ...new Set(option.addedAccounts.map(acc => acc.influencerId)),
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
                    'instagram._id', 'instagram.profileCategory',
                    'tiktok._id', 'tiktok.profileCategory',
                    'youtube._id', 'youtube.profileCategory',
                    'facebook._id', 'facebook.profileCategory',
                    'spotify._id', 'spotify.profileCategory',
                    'soundcloud._id', 'soundcloud.profileCategory',
                    'press._id', 'press.profileCategory',
                ],
            },
        );

        const influencerMap = new Map(
            influencers.map(inf => [inf._id.toString(), inf]),
        );

        option.addedAccounts = option.addedAccounts.map(acc => {
            const influencer = influencerMap.get(acc.influencerId.toString());
            if (!influencer) return acc;

            const accountsArray = influencer[acc.socialMedia] ?? [];
            const matchedAccount = accountsArray.find(
                a => a._id?.toString() === acc.accountId?.toString(),
            );

            return {
                ...acc,
                logoUrl: matchedAccount?.logoUrl ?? null,
                profileType: matchedAccount?.profileCategory ?? null,
            };
        });
    }
}
