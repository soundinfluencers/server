import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
    CampaignUpdateService,
    CampaignUpdateContext,
    CampaignDocumentLike,
    CampaignAccountLike,
} from './campaign-update.service';
import { MediaService } from '../../media/media.service';
import { UpdateCampaignDto } from '../dto/update-campaign.dto';
import { SocialMediaEnum } from '../../../common/types/social-media.types';
import { CurrencyCode } from '../../../common/types/finance.types';
import { CampaignContentItem } from '../../../database/schemas/campaign/campaign.schema';

type TestAccount = CampaignAccountLike;
type TestCampaignDoc = CampaignDocumentLike<TestAccount>;

describe('CampaignUpdateService', () => {
    let service: CampaignUpdateService;
    let mediaService: jest.Mocked<MediaService>;

    const makeObjectId = () => new Types.ObjectId();

    const makeAccount = (overrides: Partial<TestAccount> = {}): TestAccount => ({
        accountId: makeObjectId(),
        socialMedia: SocialMediaEnum.instagram,
        username: 'testuser',
        selectedContent: {
            campaignContentItemId: makeObjectId(),
            descriptionId: makeObjectId(),
        },
        dateRequest: null,
        ...overrides,
    });

    const makeContentItem = (overrides: Partial<CampaignContentItem> = {}): CampaignContentItem => ({
        _id: makeObjectId(),
        socialMedia: SocialMediaEnum.instagram,
        socialMediaGroup: 'main',
        mainLink: 'https://example.com/content',
        descriptions: [{ _id: makeObjectId(), description: 'Test description' }],
        ...overrides,
    });

    const makeCampaignDoc = (overrides: Partial<TestCampaignDoc> = {}): TestCampaignDoc => ({
        campaignName: 'Original Campaign',
        addedAccounts: [],
        campaignContent: [],
        displayCurrency: CurrencyCode.EUR,
        socialMedia: SocialMediaEnum.instagram,
        save: jest.fn().mockResolvedValue(undefined),
        toObject: jest.fn().mockReturnValue({}),
        ...overrides,
    });

    const makeContext = (overrides: Partial<CampaignUpdateContext<TestCampaignDoc, TestAccount, any, any>> = {}): CampaignUpdateContext<TestCampaignDoc, TestAccount, any, any> => ({
        findCampaign: jest.fn().mockResolvedValue(makeCampaignDoc()),
        buildCampaignAccountsBatch: jest.fn().mockResolvedValue([]),
        toReadModel: jest.fn().mockImplementation(c => c),
        mapResult: jest.fn().mockImplementation(c => c),
        ...overrides,
    });

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CampaignUpdateService,
                {
                    provide: MediaService,
                    useValue: {
                        applyMediaCacheForCreate: jest.fn().mockImplementation(content => content),
                    },
                },
            ],
        }).compile();

        service = module.get(CampaignUpdateService);
        mediaService = module.get(MediaService);
    });

    it('should throw NotFoundException when campaign is not found', async () => {
        const context = makeContext({
            findCampaign: jest.fn().mockResolvedValue(null),
        });
        const data: UpdateCampaignDto = { campaignId: 'nonexistent' };

        await expect(service.execute('nonexistent', data, context))
            .rejects
            .toThrow(NotFoundException);
    });

    it('should call findCampaign with the campaignId', async () => {
        const context = makeContext();
        const data: UpdateCampaignDto = { campaignId: 'abc' };

        await service.execute('campaign-xyz', data, context);

        expect(context.findCampaign).toHaveBeenCalledWith('campaign-xyz');
    });

    it('should update campaignName when provided and different from existing', async () => {
        const campaign = makeCampaignDoc({ campaignName: 'Old Name' });
        const context = makeContext({
            findCampaign: jest.fn().mockResolvedValue(campaign),
        });
        const data: UpdateCampaignDto = {
            campaignId: 'id',
            campaignName: 'New Name',
        };

        await service.execute('id', data, context);

        expect(campaign.campaignName).toBe('New Name');
    });

    it('should not update campaignName when trimmed value is the same', async () => {
        const campaign = makeCampaignDoc({ campaignName: 'Same Name' });
        const context = makeContext({
            findCampaign: jest.fn().mockResolvedValue(campaign),
        });
        const data: UpdateCampaignDto = {
            campaignId: 'id',
            campaignName: '  Same Name  ',
        };

        await service.execute('id', data, context);

        expect(campaign.campaignName).toBe('Same Name');
    });

    it('should not update campaignName when not provided', async () => {
        const campaign = makeCampaignDoc({ campaignName: 'Untouched' });
        const context = makeContext({
            findCampaign: jest.fn().mockResolvedValue(campaign),
        });
        const data: UpdateCampaignDto = { campaignId: 'id' };

        await service.execute('id', data, context);

        expect(campaign.campaignName).toBe('Untouched');
    });

    it('should merge existing accounts with updated fields', async () => {
        const existingAccountId = makeObjectId();
        const existingAccount = makeAccount({ accountId: existingAccountId, username: 'olduser' });
        const campaign = makeCampaignDoc({ addedAccounts: [existingAccount] });

        const newContentItemId = makeObjectId().toString();
        const newDescriptionId = makeObjectId().toString();

        const context = makeContext({
            findCampaign: jest.fn().mockResolvedValue(campaign),
        });
        const data: UpdateCampaignDto = {
            campaignId: 'id',
            addedAccounts: [{
                socialAccountId: existingAccountId.toString(),
                influencerId: makeObjectId().toString(),
                socialMedia: SocialMediaEnum.tiktok,
                username: 'newuser',
                selectedCampaignContentItem: {
                    campaignContentItemId: newContentItemId,
                    descriptionId: newDescriptionId,
                },
                dateRequest: '2025-06-01',
            }],
        };

        await service.execute('id', data, context);

        expect(campaign.addedAccounts).toHaveLength(1);
        expect(campaign.addedAccounts[0].socialMedia).toBe(SocialMediaEnum.tiktok);
        expect(campaign.addedAccounts[0].username).toBe('newuser');
        expect(campaign.addedAccounts[0].dateRequest).toBe('2025-06-01');
    });

    it('should call buildCampaignAccountsBatch for new (non-existing) accounts', async () => {
        const existingAccountId = makeObjectId();
        const existingAccount = makeAccount({ accountId: existingAccountId });
        const campaign = makeCampaignDoc({ addedAccounts: [existingAccount] });

        const newAccountDto = {
            socialAccountId: makeObjectId().toString(),
            influencerId: makeObjectId().toString(),
            socialMedia: SocialMediaEnum.youtube,
            username: 'newaccount',
            selectedCampaignContentItem: {
                campaignContentItemId: makeObjectId().toString(),
                descriptionId: makeObjectId().toString(),
            },
            dateRequest: '2025-07-01',
        };

        const newBuiltAccount = makeAccount({
            accountId: new Types.ObjectId(newAccountDto.socialAccountId),
            socialMedia: SocialMediaEnum.youtube,
            username: 'newaccount',
        });

        const buildBatch = jest.fn().mockResolvedValue([newBuiltAccount]);
        const context = makeContext({
            findCampaign: jest.fn().mockResolvedValue(campaign),
            buildCampaignAccountsBatch: buildBatch,
        });

        const data: UpdateCampaignDto = {
            campaignId: 'id',
            addedAccounts: [newAccountDto],
        };

        await service.execute('id', data, context);

        expect(buildBatch).toHaveBeenCalledWith([newAccountDto]);
        expect(campaign.addedAccounts).toContain(newBuiltAccount);
    });

    it('should update campaignContent via mapContentItemDtoToModel and mediaService', async () => {
        const campaign = makeCampaignDoc();
        const context = makeContext({
            findCampaign: jest.fn().mockResolvedValue(campaign),
        });

        const contentId = makeObjectId().toString();
        const descId = makeObjectId().toString();
        const contentDto = {
            _id: contentId,
            socialMedia: SocialMediaEnum.instagram,
            socialMediaGroup: 'main',
            mainLink: '  https://example.com/track  ',
            descriptions: [{ _id: descId, description: '  Post this  ' }],
            taggedUser: ' @user ',
        };

        const cachedContent = [{ ...makeContentItem(), cached: true }];
        mediaService.applyMediaCacheForCreate.mockResolvedValue(cachedContent as any);

        const data: UpdateCampaignDto = {
            campaignId: 'id',
            campaignContent: [contentDto as any],
        };

        await service.execute('id', data, context);

        expect(mediaService.applyMediaCacheForCreate).toHaveBeenCalled();
        expect(campaign.campaignContent).toBe(cachedContent);
    });

    it('should call campaign.save()', async () => {
        const campaign = makeCampaignDoc();
        const context = makeContext({
            findCampaign: jest.fn().mockResolvedValue(campaign),
        });
        const data: UpdateCampaignDto = { campaignId: 'id' };

        await service.execute('id', data, context);

        expect(campaign.save).toHaveBeenCalled();
    });

    it('should call toReadModel then mapResult in sequence', async () => {
        const campaign = makeCampaignDoc();
        const readModel = { readModelData: true };
        const finalResult = { finalData: true };
        const callOrder: string[] = [];

        const toReadModel = jest.fn().mockImplementation(() => {
            callOrder.push('toReadModel');
            return readModel;
        });
        const mapResult = jest.fn().mockImplementation(() => {
            callOrder.push('mapResult');
            return finalResult;
        });

        const context = makeContext({
            findCampaign: jest.fn().mockResolvedValue(campaign),
            toReadModel,
            mapResult,
        });
        const data: UpdateCampaignDto = { campaignId: 'id' };

        const result = await service.execute('id', data, context);

        expect(callOrder).toEqual(['toReadModel', 'mapResult']);
        expect(toReadModel).toHaveBeenCalledWith(campaign);
        expect(mapResult).toHaveBeenCalledWith(readModel);
        expect(result).toBe(finalResult);
    });

    it('should throw ConflictException when toReadModel throws', async () => {
        const campaign = makeCampaignDoc();
        const context = makeContext({
            findCampaign: jest.fn().mockResolvedValue(campaign),
            toReadModel: jest.fn().mockImplementation(() => {
                throw new Error('Serialization error');
            }),
        });
        const data: UpdateCampaignDto = { campaignId: 'id' };

        await expect(service.execute('id', data, context))
            .rejects
            .toThrow(ConflictException);
    });

    it('should throw ConflictException when mapResult throws', async () => {
        const campaign = makeCampaignDoc();
        const context = makeContext({
            findCampaign: jest.fn().mockResolvedValue(campaign),
            toReadModel: jest.fn().mockReturnValue({}),
            mapResult: jest.fn().mockImplementation(() => {
                throw new Error('Mapping error');
            }),
        });
        const data: UpdateCampaignDto = { campaignId: 'id' };

        await expect(service.execute('id', data, context))
            .rejects
            .toThrow(ConflictException);
    });

    it('should handle empty update (no fields provided) - just saves', async () => {
        const campaign = makeCampaignDoc({
            campaignName: 'Unchanged',
            addedAccounts: [makeAccount()],
            campaignContent: [makeContentItem()],
        });
        const originalAccounts = [...campaign.addedAccounts];
        const originalContent = [...campaign.campaignContent];

        const context = makeContext({
            findCampaign: jest.fn().mockResolvedValue(campaign),
        });
        const data: UpdateCampaignDto = { campaignId: 'id' };

        await service.execute('id', data, context);

        expect(campaign.campaignName).toBe('Unchanged');
        expect(campaign.addedAccounts).toEqual(originalAccounts);
        expect(campaign.campaignContent).toEqual(originalContent);
        expect(campaign.save).toHaveBeenCalled();
    });

    it('should set descriptionId to undefined when not provided in update DTO', async () => {
        const existingAccountId = makeObjectId();
        const existingAccount = makeAccount({ accountId: existingAccountId });
        const campaign = makeCampaignDoc({ addedAccounts: [existingAccount] });

        const context = makeContext({
            findCampaign: jest.fn().mockResolvedValue(campaign),
        });
        const data: UpdateCampaignDto = {
            campaignId: 'id',
            addedAccounts: [{
                socialAccountId: existingAccountId.toString(),
                influencerId: makeObjectId().toString(),
                socialMedia: SocialMediaEnum.instagram,
                username: 'user',
                selectedCampaignContentItem: {
                    campaignContentItemId: makeObjectId().toString(),
                    descriptionId: undefined,
                },
                dateRequest: null,
            }],
        };

        await service.execute('id', data, context);

        expect(campaign.addedAccounts[0].selectedContent.descriptionId).toBeUndefined();
    });

    it('should set dateRequest to null when not provided in account DTO', async () => {
        const existingAccountId = makeObjectId();
        const existingAccount = makeAccount({
            accountId: existingAccountId,
            dateRequest: '2025-01-01',
        });
        const campaign = makeCampaignDoc({ addedAccounts: [existingAccount] });

        const context = makeContext({
            findCampaign: jest.fn().mockResolvedValue(campaign),
        });
        const data: UpdateCampaignDto = {
            campaignId: 'id',
            addedAccounts: [{
                socialAccountId: existingAccountId.toString(),
                influencerId: makeObjectId().toString(),
                socialMedia: SocialMediaEnum.instagram,
                username: 'user',
                selectedCampaignContentItem: {
                    campaignContentItemId: makeObjectId().toString(),
                    descriptionId: makeObjectId().toString(),
                },
                dateRequest: undefined,
            }],
        };

        await service.execute('id', data, context);

        expect(campaign.addedAccounts[0].dateRequest).toBeNull();
    });

    it('should save campaign before calling toReadModel', async () => {
        const callOrder: string[] = [];
        const campaign = makeCampaignDoc({
            save: jest.fn().mockImplementation(async () => {
                callOrder.push('save');
            }),
        });

        const context = makeContext({
            findCampaign: jest.fn().mockResolvedValue(campaign),
            toReadModel: jest.fn().mockImplementation(() => {
                callOrder.push('toReadModel');
                return {};
            }),
        });
        const data: UpdateCampaignDto = { campaignId: 'id' };

        await service.execute('id', data, context);

        expect(callOrder).toEqual(['save', 'toReadModel']);
    });
});
