import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import { ProposalAccountsBuilderService } from './proposal-accounts-builder.service';
import { InfluencerRepository } from '../../../database/repositories/users/influencer.repository';
import { SocialMediaEnum } from '../../../common/types/social-media.types';
import { AccountVerifiedStatus } from '../../../common/types/user.types';
import { InfluencerConfirmationStatusEnum, InfluencerPromoClosedStatusEnum } from '../../../common/types/influencer/promo.types';
import { SelectInfluencerDto } from '../../campaigns/dto/create-campaign.dto';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeInfluencerDto(overrides: Partial<SelectInfluencerDto> = {}): SelectInfluencerDto {
    return {
        socialAccountId: new Types.ObjectId().toString(),
        influencerId: new Types.ObjectId().toString(),
        socialMedia: SocialMediaEnum.instagram,
        username: 'test_user',
        selectedCampaignContentItem: {
            campaignContentItemId: new Types.ObjectId().toString(),
            descriptionId: new Types.ObjectId().toString(),
        },
        dateRequest: '2025-01-15',
        ...overrides,
    };
}

function makeSocialAccount(overrides: Record<string, unknown> = {}) {
    return {
        _id: new Types.ObjectId(),
        username: 'test_user',
        followers: 10000,
        price: 50,
        publicPrice: 80,
        verifiedStatus: AccountVerifiedStatus.accept,
        isDeleted: false,
        isHidden: false,
        musicGenres: [],
        countries: [{ name: 'US' }],
        ...overrides,
    };
}

// ─── test suite ─────────────────────────────────────────────────────────────

describe('ProposalAccountsBuilderService', () => {
    let service: ProposalAccountsBuilderService;
    let influencerRepo: { findMany: jest.Mock };

    beforeEach(async () => {
        influencerRepo = { findMany: jest.fn().mockResolvedValue([]) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProposalAccountsBuilderService,
                { provide: InfluencerRepository, useValue: influencerRepo },
            ],
        }).compile();

        service = module.get(ProposalAccountsBuilderService);
    });

    // ── empty / null input ──────────────────────────────────────────────

    describe('empty input handling', () => {
        it('returns empty result when addedAccountsData is empty array', async () => {
            const result = await service.buildProposalAccountsBatch([]);

            expect(result).toEqual({
                accounts: [],
                publicCampaignPrice: 0,
                privateCampaignPrice: 0,
            });
            expect(influencerRepo.findMany).not.toHaveBeenCalled();
        });

        it('returns empty result when addedAccountsData is null', async () => {
            const result = await service.buildProposalAccountsBatch(null as any);

            expect(result).toEqual({
                accounts: [],
                publicCampaignPrice: 0,
                privateCampaignPrice: 0,
            });
        });

        it('returns empty result when addedAccountsData is undefined', async () => {
            const result = await service.buildProposalAccountsBatch(undefined as any);

            expect(result).toEqual({
                accounts: [],
                publicCampaignPrice: 0,
                privateCampaignPrice: 0,
            });
        });
    });

    // ── no matching influencers ─────────────────────────────────────────

    describe('when no matching influencers found', () => {
        it('returns empty result', async () => {
            influencerRepo.findMany.mockResolvedValue([]);
            const dto = makeInfluencerDto();

            const result = await service.buildProposalAccountsBatch([dto]);

            expect(result).toEqual({
                accounts: [],
                publicCampaignPrice: 0,
                privateCampaignPrice: 0,
            });
        });
    });

    // ── skip conditions ─────────────────────────────────────────────────

    describe('account filtering', () => {
        function setupWithAccount(accountOverrides: Record<string, unknown> = {}) {
            const influencerId = new Types.ObjectId();
            const accountId = new Types.ObjectId();
            const account = makeSocialAccount({ _id: accountId, ...accountOverrides });

            const dto = makeInfluencerDto({
                influencerId: influencerId.toString(),
                socialAccountId: accountId.toString(),
                socialMedia: SocialMediaEnum.instagram,
            });

            influencerRepo.findMany.mockResolvedValue([
                {
                    _id: influencerId,
                    instagram: [account],
                },
            ]);

            return { dto, account };
        }

        it('skips unverified accounts (verifiedStatus !== accept)', async () => {
            const { dto } = setupWithAccount({
                verifiedStatus: AccountVerifiedStatus.waitForAdmin,
            });

            const result = await service.buildProposalAccountsBatch([dto]);

            expect(result.accounts).toHaveLength(0);
        });

        it('skips deleted accounts', async () => {
            const { dto } = setupWithAccount({ isDeleted: true });

            const result = await service.buildProposalAccountsBatch([dto]);

            expect(result.accounts).toHaveLength(0);
        });

        it('skips hidden accounts', async () => {
            const { dto } = setupWithAccount({ isHidden: true });

            const result = await service.buildProposalAccountsBatch([dto]);

            expect(result.accounts).toHaveLength(0);
        });

        it('skips accounts with negative price', async () => {
            const { dto } = setupWithAccount({ price: -5 });

            const result = await service.buildProposalAccountsBatch([dto]);

            expect(result.accounts).toHaveLength(0);
        });

        it('skips accounts with negative publicPrice', async () => {
            const { dto } = setupWithAccount({ publicPrice: -1 });

            const result = await service.buildProposalAccountsBatch([dto]);

            expect(result.accounts).toHaveLength(0);
        });

        it('skips accounts without campaignContentItemId', async () => {
            const { dto } = setupWithAccount();

            dto.selectedCampaignContentItem = {
                campaignContentItemId: '',
                descriptionId: new Types.ObjectId().toString(),
            };

            const result = await service.buildProposalAccountsBatch([dto]);

            expect(result.accounts).toHaveLength(0);
        });
    });

    // ── successful build ────────────────────────────────────────────────

    describe('successful account building', () => {
        it('correctly builds ProposalCampaignAccount from valid data', async () => {
            const influencerId = new Types.ObjectId();
            const accountId = new Types.ObjectId();
            const contentItemId = new Types.ObjectId().toString();
            const descriptionId = new Types.ObjectId().toString();

            const account = makeSocialAccount({
                _id: accountId,
                username: 'real_user',
                followers: 5000,
                price: 100,
                publicPrice: 150,
                countries: [{ name: 'UK' }],
            });

            const dto = makeInfluencerDto({
                influencerId: influencerId.toString(),
                socialAccountId: accountId.toString(),
                socialMedia: SocialMediaEnum.instagram,
                username: 'dto_user',
                selectedCampaignContentItem: {
                    campaignContentItemId: contentItemId,
                    descriptionId,
                },
                dateRequest: '2025-06-01',
            });

            influencerRepo.findMany.mockResolvedValue([
                {
                    _id: influencerId,
                    instagram: [account],
                },
            ]);

            const result = await service.buildProposalAccountsBatch([dto]);

            expect(result.accounts).toHaveLength(1);

            const built = result.accounts[0];
            expect(built.influencerId.toString()).toBe(influencerId.toString());
            expect(built.accountId.toString()).toBe(accountId.toString());
            expect(built.username).toBe('real_user');
            expect(built.followers).toBe(5000);
            expect(built.price).toBe(100);
            expect(built.publicPrice).toBe(150);
            expect(built.confirmation).toBe(InfluencerConfirmationStatusEnum.wait);
            expect(built.closePromo).toBe(InfluencerPromoClosedStatusEnum.wait);
            expect(built.dateRequest).toBe('2025-06-01');
            expect(built.countries).toEqual([{ name: 'UK' }]);
            expect(built.selectedContent.campaignContentItemId.toString()).toBe(contentItemId);
        });

        it('sums prices correctly with multiple valid accounts', async () => {
            const influencerId = new Types.ObjectId();
            const accountId1 = new Types.ObjectId();
            const accountId2 = new Types.ObjectId();

            const account1 = makeSocialAccount({ _id: accountId1, price: 100, publicPrice: 150 });
            const account2 = makeSocialAccount({ _id: accountId2, price: 200, publicPrice: 300, username: 'user2' });

            const dto1 = makeInfluencerDto({
                influencerId: influencerId.toString(),
                socialAccountId: accountId1.toString(),
                socialMedia: SocialMediaEnum.instagram,
            });

            const dto2 = makeInfluencerDto({
                influencerId: influencerId.toString(),
                socialAccountId: accountId2.toString(),
                socialMedia: SocialMediaEnum.instagram,
                username: 'user2',
            });

            influencerRepo.findMany.mockResolvedValue([
                {
                    _id: influencerId,
                    instagram: [account1, account2],
                },
            ]);

            const result = await service.buildProposalAccountsBatch([dto1, dto2]);

            expect(result.accounts).toHaveLength(2);
            expect(result.publicCampaignPrice).toBe(450);
            expect(result.privateCampaignPrice).toBe(300);
        });
    });

    // ── username fallback matching ──────────────────────────────────────

    describe('username fallback matching', () => {
        it('falls back to username matching when no accountId match', async () => {
            const influencerId = new Types.ObjectId();
            const accountId = new Types.ObjectId();

            const account = makeSocialAccount({
                _id: accountId,
                username: 'fallback_user',
                price: 75,
                publicPrice: 100,
            });

            const dto = makeInfluencerDto({
                influencerId: influencerId.toString(),
                socialAccountId: '',
                socialMedia: SocialMediaEnum.instagram,
                username: 'fallback_user',
            });

            influencerRepo.findMany.mockResolvedValue([
                {
                    _id: influencerId,
                    instagram: [account],
                },
            ]);

            const result = await service.buildProposalAccountsBatch([dto]);

            expect(result.accounts).toHaveLength(1);
            expect(result.accounts[0].username).toBe('fallback_user');
            expect(result.publicCampaignPrice).toBe(100);
            expect(result.privateCampaignPrice).toBe(75);
        });
    });

    // ── influencerId mismatch ───────────────────────────────────────────

    describe('influencerId mismatch', () => {
        it('skips account when dto influencerId does not match found influencer', async () => {
            const realInfluencerId = new Types.ObjectId();
            const wrongInfluencerId = new Types.ObjectId();
            const accountId = new Types.ObjectId();

            const account = makeSocialAccount({ _id: accountId });

            const dto = makeInfluencerDto({
                influencerId: wrongInfluencerId.toString(),
                socialAccountId: accountId.toString(),
                socialMedia: SocialMediaEnum.instagram,
            });

            influencerRepo.findMany.mockResolvedValue([
                {
                    _id: realInfluencerId,
                    instagram: [account],
                },
            ]);

            const result = await service.buildProposalAccountsBatch([dto]);

            expect(result.accounts).toHaveLength(0);
        });
    });
});
