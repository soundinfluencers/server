import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import {
    ProposalCampaignUpdateService,
    ProposalCampaignUpdateContext,
    ProposalCampaignDocLike,
    ProposalOptionDocLike,
    ProposalAccountLike,
} from './proposal-campaign-update.service';
import { MediaService } from '../../media/media.service';
import { SocialMediaEnum } from '../../../common/types/social-media.types';
import { UpdateCampaignDto } from '../../campaigns/dto/update-campaign.dto';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeCampaign(overrides: Record<string, unknown> = {}): ProposalCampaignDocLike {
    return {
        _id: new Types.ObjectId(),
        campaignName: 'Test Proposal',
        save: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    } as any;
}

function makeOptionDoc(overrides: Record<string, unknown> = {}): ProposalOptionDocLike<any> {
    return {
        addedAccounts: [],
        campaignContent: [],
        publicCampaignPrice: 0,
        privateCampaignPrice: 0,
        save: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    } as any;
}

function makeContext(
    overrides: Partial<ProposalCampaignUpdateContext<any, any, any, any, any>> = {},
): ProposalCampaignUpdateContext<any, any, any, any, any> {
    return {
        findCampaign: jest.fn().mockResolvedValue(null),
        findOption: jest.fn().mockResolvedValue(null),
        buildProposalAccountsBatch: jest.fn().mockResolvedValue({
            accounts: [],
            publicCampaignPrice: 0,
            privateCampaignPrice: 0,
        }),
        toReadModel: jest.fn().mockReturnValue({ readModel: true }),
        mapResult: jest.fn().mockReturnValue('mapped'),
        ...overrides,
    };
}

function makeExistingAccount(accountId: Types.ObjectId, price = 10, publicPrice = 15) {
    return {
        _id: new Types.ObjectId(),
        accountId,
        influencerId: new Types.ObjectId(),
        socialMedia: SocialMediaEnum.instagram,
        username: 'existing_user',
        price,
        publicPrice,
        selectedContent: {
            campaignContentItemId: new Types.ObjectId(),
            descriptionId: new Types.ObjectId(),
        },
        dateRequest: null,
    };
}

// ─── test suite ─────────────────────────────────────────────────────────────

describe('ProposalCampaignUpdateService', () => {
    let service: ProposalCampaignUpdateService;
    let mediaService: { applyMediaCacheForCreate: jest.Mock };

    beforeEach(async () => {
        mediaService = { applyMediaCacheForCreate: jest.fn().mockImplementation(v => v) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProposalCampaignUpdateService,
                { provide: MediaService, useValue: mediaService },
            ],
        }).compile();

        service = module.get(ProposalCampaignUpdateService);
    });

    // ── campaign not found ──────────────────────────────────────────────

    describe('when campaign is not found', () => {
        it('throws NotFoundException', async () => {
            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(null),
            });

            await expect(
                service.execute('nonexistent', 0, {} as UpdateCampaignDto, context),
            ).rejects.toThrow(NotFoundException);
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
                service.execute('id', 0, {} as UpdateCampaignDto, context),
            ).rejects.toThrow(NotFoundException);
        });
    });

    // ── save called ─────────────────────────────────────────────────────

    describe('when no data updates are provided', () => {
        it('calls option.save()', async () => {
            const campaign = makeCampaign();
            const option = makeOptionDoc();
            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(option),
            });

            await service.execute('id', 0, {} as UpdateCampaignDto, context);

            expect(option.save).toHaveBeenCalledTimes(1);
        });
    });

    // ── campaignName update ─────────────────────────────────────────────

    describe('campaignName updates', () => {
        it('updates campaignName on the campaign document and saves it', async () => {
            const campaign = makeCampaign({ campaignName: 'Old Name' });
            const option = makeOptionDoc();
            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(option),
            });

            const data: UpdateCampaignDto = {
                campaignId: 'id',
                campaignName: 'New Name',
            };

            await service.execute('id', 0, data, context);

            expect(campaign.campaignName).toBe('New Name');
            expect(campaign.save).toHaveBeenCalledTimes(1);
        });

        it('does not update campaignName when trimmed value is the same', async () => {
            const campaign = makeCampaign({ campaignName: 'Same Name' });
            const option = makeOptionDoc();
            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(option),
            });

            const data: UpdateCampaignDto = {
                campaignId: 'id',
                campaignName: '  Same Name  ',
            };

            await service.execute('id', 0, data, context);

            expect(campaign.save).not.toHaveBeenCalled();
        });

        it('does not save campaign when campaignName is not provided', async () => {
            const campaign = makeCampaign();
            const option = makeOptionDoc();
            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(option),
            });

            await service.execute('id', 0, {} as UpdateCampaignDto, context);

            expect(campaign.save).not.toHaveBeenCalled();
        });
    });

    // ── addedAccounts merging ───────────────────────────────────────────

    describe('addedAccounts updates', () => {
        it('merges existing accounts by accountId and recalculates prices', async () => {
            const existingAccountId = new Types.ObjectId();
            const existingAccount = makeExistingAccount(existingAccountId, 50, 80);

            const campaign = makeCampaign();
            const option = makeOptionDoc({
                addedAccounts: [existingAccount],
            });

            const contentItemId = new Types.ObjectId().toString();

            const data: UpdateCampaignDto = {
                campaignId: 'id',
                addedAccounts: [
                    {
                        socialAccountId: existingAccountId.toString(),
                        influencerId: new Types.ObjectId().toString(),
                        socialMedia: SocialMediaEnum.instagram,
                        username: 'updated_user',
                        selectedCampaignContentItem: {
                            campaignContentItemId: contentItemId,
                            descriptionId: new Types.ObjectId().toString(),
                        },
                        dateRequest: '2025-01-01',
                    },
                ],
            };

            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(option),
            });

            await service.execute('id', 0, data, context);

            expect(option.addedAccounts).toHaveLength(1);
            expect(option.addedAccounts[0].username).toBe('updated_user');
            expect(option.publicCampaignPrice).toBe(80);
            expect(option.privateCampaignPrice).toBe(50);
        });

        it('calls buildProposalAccountsBatch for new accounts', async () => {
            const campaign = makeCampaign();
            const option = makeOptionDoc({ addedAccounts: [] });

            const newAccountDto = {
                socialAccountId: new Types.ObjectId().toString(),
                influencerId: new Types.ObjectId().toString(),
                socialMedia: SocialMediaEnum.tiktok,
                username: 'new_user',
                selectedCampaignContentItem: {
                    campaignContentItemId: new Types.ObjectId().toString(),
                    descriptionId: new Types.ObjectId().toString(),
                },
                dateRequest: '2025-02-01',
            };

            const builtAccount = {
                _id: new Types.ObjectId(),
                accountId: new Types.ObjectId(),
                influencerId: new Types.ObjectId(),
                socialMedia: SocialMediaEnum.tiktok,
                username: 'new_user',
                price: 20,
                publicPrice: 30,
            };

            const buildBatch = jest.fn().mockResolvedValue({
                accounts: [builtAccount],
                publicCampaignPrice: 30,
                privateCampaignPrice: 20,
            });

            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(option),
                buildProposalAccountsBatch: buildBatch,
            });

            const data: UpdateCampaignDto = {
                campaignId: 'id',
                addedAccounts: [newAccountDto],
            };

            await service.execute('id', 0, data, context);

            expect(buildBatch).toHaveBeenCalledWith([newAccountDto]);
            expect(option.addedAccounts).toHaveLength(1);
            expect(option.publicCampaignPrice).toBe(30);
            expect(option.privateCampaignPrice).toBe(20);
        });

        it('combines prices from existing and new accounts', async () => {
            const existingAccountId = new Types.ObjectId();
            const existingAccount = makeExistingAccount(existingAccountId, 40, 60);

            const campaign = makeCampaign();
            const option = makeOptionDoc({ addedAccounts: [existingAccount] });

            const newAccountDto = {
                socialAccountId: new Types.ObjectId().toString(),
                influencerId: new Types.ObjectId().toString(),
                socialMedia: SocialMediaEnum.instagram,
                username: 'brand_new',
                selectedCampaignContentItem: {
                    campaignContentItemId: new Types.ObjectId().toString(),
                    descriptionId: new Types.ObjectId().toString(),
                },
                dateRequest: '2025-03-01',
            };

            const buildBatch = jest.fn().mockResolvedValue({
                accounts: [{ price: 25, publicPrice: 35 }],
                publicCampaignPrice: 35,
                privateCampaignPrice: 25,
            });

            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(option),
                buildProposalAccountsBatch: buildBatch,
            });

            const data: UpdateCampaignDto = {
                campaignId: 'id',
                addedAccounts: [
                    {
                        socialAccountId: existingAccountId.toString(),
                        influencerId: new Types.ObjectId().toString(),
                        socialMedia: SocialMediaEnum.instagram,
                        username: 'existing_user',
                        selectedCampaignContentItem: {
                            campaignContentItemId: new Types.ObjectId().toString(),
                            descriptionId: new Types.ObjectId().toString(),
                        },
                        dateRequest: null as any,
                    },
                    newAccountDto,
                ],
            };

            await service.execute('id', 0, data, context);

            expect(option.publicCampaignPrice).toBe(60 + 35);
            expect(option.privateCampaignPrice).toBe(40 + 25);
        });
    });

    // ── campaignContent updates ─────────────────────────────────────────

    describe('campaignContent updates', () => {
        it('applies media cache and updates option.campaignContent', async () => {
            const campaign = makeCampaign();
            const option = makeOptionDoc();

            const contentItemDto = {
                _id: new Types.ObjectId().toString(),
                socialMedia: SocialMediaEnum.instagram,
                socialMediaGroup: 'stories',
                mainLink: 'https://example.com/video',
                descriptions: [{ _id: new Types.ObjectId().toString(), description: 'desc' }],
            };

            const cachedContent = [{ cached: true }];
            mediaService.applyMediaCacheForCreate.mockResolvedValue(cachedContent);

            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(option),
            });

            const data: UpdateCampaignDto = {
                campaignId: 'id',
                campaignContent: [contentItemDto] as any,
            };

            await service.execute('id', 0, data, context);

            expect(mediaService.applyMediaCacheForCreate).toHaveBeenCalledTimes(1);
            expect(option.campaignContent).toEqual(cachedContent);
            expect(option.save).toHaveBeenCalledTimes(1);
        });
    });

    // ── toReadModel + mapResult ─────────────────────────────────────────

    describe('toReadModel + mapResult pipeline', () => {
        it('calls toReadModel then mapResult in sequence and returns final value', async () => {
            const campaign = makeCampaign();
            const option = makeOptionDoc();
            const toReadModel = jest.fn().mockReturnValue({ intermediate: true });
            const mapResult = jest.fn().mockReturnValue({ final: true });

            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(option),
                toReadModel,
                mapResult,
            });

            const result = await service.execute('id', 0, {} as UpdateCampaignDto, context);

            expect(toReadModel).toHaveBeenCalledWith(campaign, option);
            expect(mapResult).toHaveBeenCalledWith({ intermediate: true });
            expect(result).toEqual({ final: true });
        });

        it('throws ConflictException when toReadModel throws', async () => {
            const campaign = makeCampaign();
            const option = makeOptionDoc();

            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(option),
                toReadModel: jest.fn().mockImplementation(() => {
                    throw new Error('serialization error');
                }),
            });

            await expect(
                service.execute('id', 0, {} as UpdateCampaignDto, context),
            ).rejects.toThrow(ConflictException);
        });

        it('throws ConflictException when mapResult throws', async () => {
            const campaign = makeCampaign();
            const option = makeOptionDoc();

            const context = makeContext({
                findCampaign: jest.fn().mockResolvedValue(campaign),
                findOption: jest.fn().mockResolvedValue(option),
                toReadModel: jest.fn().mockReturnValue({}),
                mapResult: jest.fn().mockImplementation(() => {
                    throw new Error('mapping error');
                }),
            });

            await expect(
                service.execute('id', 0, {} as UpdateCampaignDto, context),
            ).rejects.toThrow(ConflictException);
        });
    });
});
