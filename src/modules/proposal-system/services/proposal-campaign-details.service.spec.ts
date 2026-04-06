import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { ProposalCampaignDetailsService, ProposalCampaignDetailsContext } from './proposal-campaign-details.service';
import { InfluencerRepository } from '../../../database/repositories/users/influencer.repository';
import { SocialMediaEnum } from '../../../common/types/social-media.types';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeCampaign(overrides: Record<string, unknown> = {}) {
    return {
        _id: new Types.ObjectId(),
        campaignName: 'Test Proposal',
        socialMedia: SocialMediaEnum.instagram,
        optionsIds: [new Types.ObjectId()],
        ...overrides,
    };
}

function makeOption(overrides: Record<string, unknown> = {}) {
    return {
        _id: new Types.ObjectId(),
        addedAccounts: [],
        campaignContent: [],
        publicCampaignPrice: 100,
        privateCampaignPrice: 80,
        ...overrides,
    };
}

function makeContext<T>(overrides: Partial<ProposalCampaignDetailsContext<T>> = {}): ProposalCampaignDetailsContext<T> {
    return {
        findCampaign: jest.fn().mockResolvedValue(null),
        findOption: jest.fn().mockResolvedValue(null),
        mapResult: jest.fn().mockReturnValue('mapped'),
        ...overrides,
    } as any;
}

// ─── test suite ─────────────────────────────────────────────────────────────

describe('ProposalCampaignDetailsService', () => {
    let service: ProposalCampaignDetailsService;
    let influencerRepo: { findMany: jest.Mock };

    beforeEach(async () => {
        influencerRepo = { findMany: jest.fn().mockResolvedValue([]) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProposalCampaignDetailsService,
                { provide: InfluencerRepository, useValue: influencerRepo },
            ],
        }).compile();

        service = module.get(ProposalCampaignDetailsService);
    });

    // ── campaign not found ──────────────────────────────────────────────

    describe('when campaign is not found', () => {
        it('throws NotFoundException', async () => {
            const context = makeContext({ findCampaign: jest.fn().mockResolvedValue(null) });

            await expect(
                service.execute('nonexistent-id', 0, context),
            ).rejects.toThrow(NotFoundException);
        });

        it('calls findCampaign with the provided campaignId', async () => {
            const context = makeContext({ findCampaign: jest.fn().mockResolvedValue(null) });

            await service.execute('my-campaign-id', 0, context).catch(() => {});

            expect(context.findCampaign).toHaveBeenCalledWith('my-campaign-id');
        });
    });

    // ── option not found ────────────────────────────────────────────────

    describe('when option is not found', () => {
        it('throws NotFoundException', async () => {
            const campaign = makeCampaign();
            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(null),
            });

            await expect(
                service.execute('id', 0, context),
            ).rejects.toThrow(NotFoundException);
        });

        it('calls findOption with campaign._id and optionIndex', async () => {
            const campaign = makeCampaign();
            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(null),
            });

            await service.execute('id', 2, context).catch(() => {});

            expect(context.findOption).toHaveBeenCalledWith(campaign._id, 2);
        });
    });

    // ── happy path ──────────────────────────────────────────────────────

    describe('when campaign and option are found', () => {
        it('calls mapResult with campaign and option', async () => {
            const campaign = makeCampaign();
            const option = makeOption();
            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(option),
                mapResult: jest.fn().mockReturnValue('result'),
            });

            const result = await service.execute('id', 0, context);

            expect(context.mapResult).toHaveBeenCalledWith(campaign, option);
            expect(result).toBe('result');
        });

        it('handles empty addedAccounts array without calling influencerRepo', async () => {
            const campaign = makeCampaign();
            const option = makeOption({ addedAccounts: [] });
            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(option),
            });

            await service.execute('id', 0, context);

            expect(influencerRepo.findMany).toHaveBeenCalledWith(
                { _id: { $in: [] } },
                expect.objectContaining({ lean: true }),
            );
        });
    });

    // ── logo attachment ─────────────────────────────────────────────────

    describe('logo attachment', () => {
        it('attaches logoUrl from matching influencer account', async () => {
            const influencerId = new Types.ObjectId();
            const accountId = new Types.ObjectId();

            const option = makeOption({
                addedAccounts: [
                    {
                        influencerId,
                        accountId,
                        socialMedia: SocialMediaEnum.instagram,
                        username: 'user1',
                    },
                ],
            });

            const campaign = makeCampaign();

            influencerRepo.findMany.mockResolvedValue([
                {
                    _id: influencerId,
                    instagram: [
                        { _id: accountId, logoUrl: 'https://logo.png' },
                    ],
                },
            ]);

            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(option),
                mapResult: jest.fn().mockImplementation((_c, opt) => opt),
            });

            const result: any = await service.execute('id', 0, context);

            expect(result.addedAccounts[0].logoUrl).toBe('https://logo.png');
        });

        it('sets logoUrl to null when influencer not found in map', async () => {
            const influencerId = new Types.ObjectId();
            const accountId = new Types.ObjectId();

            const option = makeOption({
                addedAccounts: [
                    {
                        influencerId,
                        accountId,
                        socialMedia: SocialMediaEnum.instagram,
                        username: 'user1',
                    },
                ],
            });

            const campaign = makeCampaign();

            influencerRepo.findMany.mockResolvedValue([]);

            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(option),
                mapResult: jest.fn().mockImplementation((_c, opt) => opt),
            });

            const result: any = await service.execute('id', 0, context);

            expect(result.addedAccounts[0].logoUrl).toBeUndefined();
        });

        it('sets logoUrl to null when account not found within influencer platform', async () => {
            const influencerId = new Types.ObjectId();
            const accountId = new Types.ObjectId();
            const differentAccountId = new Types.ObjectId();

            const option = makeOption({
                addedAccounts: [
                    {
                        influencerId,
                        accountId,
                        socialMedia: SocialMediaEnum.tiktok,
                        username: 'user1',
                    },
                ],
            });

            const campaign = makeCampaign();

            influencerRepo.findMany.mockResolvedValue([
                {
                    _id: influencerId,
                    tiktok: [
                        { _id: differentAccountId, logoUrl: 'https://other.png' },
                    ],
                },
            ]);

            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(option),
                mapResult: jest.fn().mockImplementation((_c, opt) => opt),
            });

            const result: any = await service.execute('id', 0, context);

            expect(result.addedAccounts[0].logoUrl).toBeNull();
        });

        it('deduplicates influencer IDs before querying', async () => {
            const influencerId = new Types.ObjectId();

            const option = makeOption({
                addedAccounts: [
                    { influencerId, accountId: new Types.ObjectId(), socialMedia: SocialMediaEnum.instagram, username: 'a' },
                    { influencerId, accountId: new Types.ObjectId(), socialMedia: SocialMediaEnum.instagram, username: 'b' },
                ],
            });

            const campaign = makeCampaign();
            influencerRepo.findMany.mockResolvedValue([]);

            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(option),
            });

            await service.execute('id', 0, context);

            const calledIds = influencerRepo.findMany.mock.calls[0][0]._id.$in;
            expect(calledIds).toHaveLength(1);
        });
    });
});
