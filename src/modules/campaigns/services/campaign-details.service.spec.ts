import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CampaignDetailsService, CampaignDetailsContext } from './campaign-details.service';
import { InfluencerRepository } from '../../../database/repositories/users/influencer.repository';
import { ICampaignDetails, ICampaignAccount, CampaignStatusEnum } from '../../../common/types/client/campaign.types';
import { SocialMediaEnum } from '../../../common/types/social-media.types';
import { CurrencyCode } from '../../../common/types/finance.types';
import { InfluencerConfirmationStatusEnum, InfluencerPromoClosedStatusEnum } from '../../../common/types/influencer/promo.types';

describe('CampaignDetailsService', () => {
    let service: CampaignDetailsService;
    let influencerRepo: jest.Mocked<InfluencerRepository>;

    const makeObjectId = () => new Types.ObjectId();

    const makeAccount = (overrides: Partial<ICampaignAccount> = {}): ICampaignAccount => ({
        addedAccountsId: makeObjectId(),
        socialAccountId: makeObjectId(),
        influencerId: makeObjectId(),
        socialMedia: SocialMediaEnum.instagram,
        username: 'testuser',
        publicPrice: 100,
        followers: 5000,
        selectedContent: {
            campaignContentItemId: makeObjectId(),
            descriptionId: makeObjectId(),
        },
        confirmation: InfluencerConfirmationStatusEnum.wait,
        closePromo: InfluencerPromoClosedStatusEnum.wait,
        ...overrides,
    });

    const makeCampaign = (overrides: Partial<ICampaignDetails> = {}): ICampaignDetails => ({
        _id: makeObjectId(),
        campaignName: 'Test Campaign',
        socialMedia: 'instagram',
        createdAt: new Date('2025-01-01'),
        price: 500,
        displayCurrency: CurrencyCode.EUR,
        status: CampaignStatusEnum.pending,
        addedAccounts: [],
        campaignContent: [],
        shareLink: 'https://example.com/share',
        totalFollowers: 0,
        totalImpressions: 0,
        totalLikes: 0,
        totalSaves: 0,
        totalComments: 0,
        totalShares: 0,
        isCpmAndResultHidden: false,
        isPriceHidden: false,
        ...overrides,
    });

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CampaignDetailsService,
                {
                    provide: InfluencerRepository,
                    useValue: {
                        findMany: jest.fn().mockResolvedValue([]),
                    },
                },
            ],
        }).compile();

        service = module.get(CampaignDetailsService);
        influencerRepo = module.get(InfluencerRepository);
    });

    it('should throw NotFoundException when findCampaign returns null', async () => {
        const context: CampaignDetailsContext<ICampaignDetails, any> = {
            findCampaign: jest.fn().mockResolvedValue(null),
            mapResult: jest.fn(),
        };

        await expect(service.execute('nonexistent-id', context))
            .rejects
            .toThrow(NotFoundException);
    });

    it('should call findCampaign with the provided campaignId', async () => {
        const campaign = makeCampaign();
        const findCampaign = jest.fn().mockResolvedValue(campaign);
        const context: CampaignDetailsContext<ICampaignDetails, any> = {
            findCampaign,
            mapResult: jest.fn().mockReturnValue({}),
        };

        await service.execute('campaign-123', context);

        expect(findCampaign).toHaveBeenCalledWith('campaign-123');
    });

    it('should call mapResult with the campaign after logo attachment', async () => {
        const campaign = makeCampaign();
        const mapResult = jest.fn().mockReturnValue({ mapped: true });
        const context: CampaignDetailsContext<ICampaignDetails, any> = {
            findCampaign: jest.fn().mockResolvedValue(campaign),
            mapResult,
        };

        await service.execute('id', context);

        expect(mapResult).toHaveBeenCalledTimes(1);
        expect(mapResult).toHaveBeenCalledWith(expect.objectContaining({
            _id: campaign._id,
            campaignName: campaign.campaignName,
        }));
    });

    it('should return the output of mapResult', async () => {
        const expected = { campaignId: 'abc', name: 'Test' };
        const context: CampaignDetailsContext<ICampaignDetails, typeof expected> = {
            findCampaign: jest.fn().mockResolvedValue(makeCampaign()),
            mapResult: jest.fn().mockReturnValue(expected),
        };

        const result = await service.execute('id', context);

        expect(result).toBe(expected);
    });

    it('should handle campaign with empty addedAccounts', async () => {
        const campaign = makeCampaign({ addedAccounts: [] });
        const mapResult = jest.fn().mockImplementation(c => c);
        const context: CampaignDetailsContext<ICampaignDetails, ICampaignDetails> = {
            findCampaign: jest.fn().mockResolvedValue(campaign),
            mapResult,
        };

        const result = await service.execute('id', context);

        expect(result.addedAccounts).toEqual([]);
        expect(influencerRepo.findMany).toHaveBeenCalledWith(
            { _id: { $in: [] } },
            expect.any(Object),
        );
    });

    it('should use InfluencerRepository.findMany to fetch logo data', async () => {
        const influencerId = makeObjectId();
        const account = makeAccount({ influencerId });
        const campaign = makeCampaign({ addedAccounts: [account] });

        const context: CampaignDetailsContext<ICampaignDetails, ICampaignDetails> = {
            findCampaign: jest.fn().mockResolvedValue(campaign),
            mapResult: jest.fn().mockImplementation(c => c),
        };

        await service.execute('id', context);

        expect(influencerRepo.findMany).toHaveBeenCalledWith(
            { _id: { $in: [influencerId] } },
            {
                lean: true,
                select: expect.arrayContaining([
                    '_id',
                    'instagram._id', 'instagram.logoUrl',
                    'tiktok._id', 'tiktok.logoUrl',
                ]),
            },
        );
    });

    it('should attach logos correctly from influencer data', async () => {
        const influencerId = makeObjectId();
        const accountId = makeObjectId();

        const account = makeAccount({
            addedAccountsId: makeObjectId(),
            socialAccountId: accountId,
            influencerId,
            socialMedia: SocialMediaEnum.instagram,
        });
        const campaign = makeCampaign({ addedAccounts: [account] });

        influencerRepo.findMany.mockResolvedValue([
            {
                _id: influencerId,
                instagram: [
                    { _id: accountId, logoUrl: 'https://cdn.example.com/logo.png' },
                ],
            },
        ] as any);

        const mapResult = jest.fn().mockImplementation(c => c);
        const context: CampaignDetailsContext<ICampaignDetails, ICampaignDetails> = {
            findCampaign: jest.fn().mockResolvedValue(campaign),
            mapResult,
        };

        const result = await service.execute('id', context);

        expect(result.addedAccounts[0]).toEqual(expect.objectContaining({
            logoUrl: 'https://cdn.example.com/logo.png',
        }));
    });

    it('should set logoUrl to null when influencer is not found in map', async () => {
        const account = makeAccount({ influencerId: makeObjectId() });
        const campaign = makeCampaign({ addedAccounts: [account] });

        influencerRepo.findMany.mockResolvedValue([]);

        const mapResult = jest.fn().mockImplementation(c => c);
        const context: CampaignDetailsContext<ICampaignDetails, ICampaignDetails> = {
            findCampaign: jest.fn().mockResolvedValue(campaign),
            mapResult,
        };

        const result = await service.execute('id', context);

        expect(result.addedAccounts[0].logoUrl).toBeUndefined();
    });

    it('should set logoUrl to null when social media account is not matched', async () => {
        const influencerId = makeObjectId();
        const accountId = makeObjectId();
        const differentAccountId = makeObjectId();

        const account = makeAccount({
            addedAccountsId: makeObjectId(),
            socialAccountId: accountId,
            influencerId,
            socialMedia: SocialMediaEnum.instagram,
        });
        const campaign = makeCampaign({ addedAccounts: [account] });

        influencerRepo.findMany.mockResolvedValue([
            {
                _id: influencerId,
                instagram: [
                    { _id: differentAccountId, logoUrl: 'https://other.com/logo.png' },
                ],
            },
        ] as any);

        const mapResult = jest.fn().mockImplementation(c => c);
        const context: CampaignDetailsContext<ICampaignDetails, ICampaignDetails> = {
            findCampaign: jest.fn().mockResolvedValue(campaign),
            mapResult,
        };

        const result = await service.execute('id', context);

        expect(result.addedAccounts[0].logoUrl).toBeNull();
    });

    it('should deduplicate influencer ids when fetching logos', async () => {
        const influencerId = makeObjectId();
        const acc1 = makeAccount({ influencerId });
        const acc2 = makeAccount({ influencerId });
        const campaign = makeCampaign({ addedAccounts: [acc1, acc2] });

        const context: CampaignDetailsContext<ICampaignDetails, ICampaignDetails> = {
            findCampaign: jest.fn().mockResolvedValue(campaign),
            mapResult: jest.fn().mockImplementation(c => c),
        };

        await service.execute('id', context);

        const calledIds = influencerRepo.findMany.mock.calls[0][0]._id.$in;
        expect(calledIds).toHaveLength(1);
        expect(calledIds[0].toString()).toBe(influencerId.toString());
    });

    it('should handle multiple accounts from different influencers', async () => {
        const inf1Id = makeObjectId();
        const inf2Id = makeObjectId();
        const acc1Id = makeObjectId();
        const acc2Id = makeObjectId();

        const acc1 = makeAccount({
            addedAccountsId: makeObjectId(),
            socialAccountId: acc1Id,
            influencerId: inf1Id,
            socialMedia: SocialMediaEnum.tiktok,
        });
        const acc2 = makeAccount({
            addedAccountsId: makeObjectId(),
            socialAccountId: acc2Id,
            influencerId: inf2Id,
            socialMedia: SocialMediaEnum.youtube,
        });
        const campaign = makeCampaign({ addedAccounts: [acc1, acc2] });

        influencerRepo.findMany.mockResolvedValue([
            {
                _id: inf1Id,
                tiktok: [{ _id: acc1Id, logoUrl: 'tiktok-logo.png' }],
            },
            {
                _id: inf2Id,
                youtube: [{ _id: acc2Id, logoUrl: 'youtube-logo.png' }],
            },
        ] as any);

        const mapResult = jest.fn().mockImplementation(c => c);
        const context: CampaignDetailsContext<ICampaignDetails, ICampaignDetails> = {
            findCampaign: jest.fn().mockResolvedValue(campaign),
            mapResult,
        };

        const result = await service.execute('id', context);

        expect(result.addedAccounts[0].logoUrl).toBe('tiktok-logo.png');
        expect(result.addedAccounts[1].logoUrl).toBe('youtube-logo.png');
    });

    it('should handle influencer with empty social media array', async () => {
        const influencerId = makeObjectId();
        const account = makeAccount({
            influencerId,
            socialMedia: SocialMediaEnum.spotify,
        });
        const campaign = makeCampaign({ addedAccounts: [account] });

        influencerRepo.findMany.mockResolvedValue([
            { _id: influencerId, spotify: [] },
        ] as any);

        const mapResult = jest.fn().mockImplementation(c => c);
        const context: CampaignDetailsContext<ICampaignDetails, ICampaignDetails> = {
            findCampaign: jest.fn().mockResolvedValue(campaign),
            mapResult,
        };

        const result = await service.execute('id', context);

        expect(result.addedAccounts[0].logoUrl).toBeNull();
    });
});
