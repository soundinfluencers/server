import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { InfluencerRepository } from '../../../database/repositories/users/influencer.repository';
import { CurrencyCode } from "../../../common/types/finance.types";

// ─── structural constraints (mirrors CampaignDetailsService pattern) ───────

export type ProposalAccountDetailsLike = {
    influencerId: Types.ObjectId;
    accountId: Types.ObjectId;
    socialMedia: string;
    followers: number;
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
    ) { }

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

        let option = await context.findOption(campaign._id, optionIndex);

        if (!option) {
            throw new NotFoundException('Proposal campaign option not found');
        }

        option = await this.attachLogos(option);

        return context.mapResult(campaign, option);
    }

    private async attachLogos<TOption extends ProposalOptionDetailsLike>(
        option: TOption,
    ): Promise<any> {
        const influencerIds = [
            ...new Set(option.addedAccounts.map(acc => acc.influencerId)),
        ];

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
            'followers',
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
                select: select,
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
                currency: matchedAccount?.currency ?? CurrencyCode.EUR,
                followers: matchedAccount?.followers ?? acc.followers
            };
        });

        return option;
    }
}
