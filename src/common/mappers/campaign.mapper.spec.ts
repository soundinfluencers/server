import { Types } from 'mongoose';
import { SocialMediaEnum } from '../types/social-media.types';
import {
    InfluencerConfirmationStatusEnum,
    InfluencerPromoClosedStatusEnum,
} from '../types/influencer/promo.types';
import { CampaignStatusEnum } from '../types/client/campaign.types';
import {
    mapContentItemDtoToModel,
    mapToICampaignAccount,
    mapToIAdminCampaignAccount,
    mapProposalToIAdminCampaignDetails,
    mapToAdminCampaignDetailsDto,
} from './campaign.mapper';
import { CampaignContentItemDto } from '../../modules/campaigns/dto/create-campaign.dto';
import { CampaignAccount } from '../../database/schemas/campaign/campaign.schema';
import { ProposalCampaignAccount } from '../../database/schemas/campaign/proposal-campaign-option.schema';
import { ProposalCampaign } from '../../database/schemas/campaign/proposal-campaign.schema';
import { ProposalCampaignOption } from '../../database/schemas/campaign/proposal-campaign-option.schema';
import { formatDate } from '../utils/formatters';

const makeObjectId = () => new Types.ObjectId();

describe('mapContentItemDtoToModel', () => {
    const makeDto = (overrides: Partial<CampaignContentItemDto> = {}): CampaignContentItemDto => ({
        _id: makeObjectId().toString(),
        socialMedia: SocialMediaEnum.instagram,
        socialMediaGroup: 'main',
        mainLink: 'https://example.com/track',
        descriptions: [{ _id: makeObjectId().toString(), description: 'Post this track' }],
        ...overrides,
    });

    it('should convert string _id to ObjectId', () => {
        const idStr = makeObjectId().toString();
        const dto = makeDto({ _id: idStr });

        const result = mapContentItemDtoToModel(dto);

        expect(result._id).toBeInstanceOf(Types.ObjectId);
        expect(result._id.toString()).toBe(idStr);
    });

    it('should trim mainLink', () => {
        const dto = makeDto({ mainLink: '  https://example.com/track  ' });

        const result = mapContentItemDtoToModel(dto);

        expect(result.mainLink).toBe('https://example.com/track');
    });

    it('should map descriptions with ObjectId _ids', () => {
        const descId = makeObjectId().toString();
        const dto = makeDto({
            descriptions: [
                { _id: descId, description: '  Trimmed description  ' },
            ],
        });

        const result = mapContentItemDtoToModel(dto);

        expect(result.descriptions).toHaveLength(1);
        expect(result.descriptions[0]._id).toBeInstanceOf(Types.ObjectId);
        expect(result.descriptions[0]._id.toString()).toBe(descId);
        expect(result.descriptions[0].description).toBe('Trimmed description');
    });

    it('should handle multiple descriptions', () => {
        const dto = makeDto({
            descriptions: [
                { _id: makeObjectId().toString(), description: 'First' },
                { _id: makeObjectId().toString(), description: 'Second' },
            ],
        });

        const result = mapContentItemDtoToModel(dto);

        expect(result.descriptions).toHaveLength(2);
    });

    it('should trim optional taggedUser when present', () => {
        const dto = makeDto({ taggedUser: '  @user123  ' });

        const result = mapContentItemDtoToModel(dto);

        expect(result.taggedUser).toBe('@user123');
    });

    it('should set taggedUser to undefined when not provided', () => {
        const dto = makeDto({ taggedUser: undefined });

        const result = mapContentItemDtoToModel(dto);

        expect(result.taggedUser).toBeUndefined();
    });

    it('should trim optional taggedLink when present', () => {
        const dto = makeDto({ taggedLink: '  https://example.com  ' });

        const result = mapContentItemDtoToModel(dto);

        expect(result.taggedLink).toBe('https://example.com');
    });

    it('should trim optional additionalBrief when present', () => {
        const dto = makeDto({ additionalBrief: '  Please post at 6pm  ' });

        const result = mapContentItemDtoToModel(dto);

        expect(result.additionalBrief).toBe('Please post at 6pm');
    });

    it('should set additionalBrief to undefined when not provided', () => {
        const dto = makeDto({ additionalBrief: undefined });

        const result = mapContentItemDtoToModel(dto);

        expect(result.additionalBrief).toBeUndefined();
    });

    it('should preserve socialMedia and socialMediaGroup', () => {
        const dto = makeDto({
            socialMedia: SocialMediaEnum.tiktok,
            socialMediaGroup: 'reels',
        });

        const result = mapContentItemDtoToModel(dto);

        expect(result.socialMedia).toBe(SocialMediaEnum.tiktok);
        expect(result.socialMediaGroup).toBe('reels');
    });
});

describe('mapToICampaignAccount', () => {
    const makeSchemaAccount = (overrides: Partial<CampaignAccount> = {}): CampaignAccount => ({
        _id: makeObjectId(),
        influencerId: makeObjectId(),
        accountId: makeObjectId(),
        socialMedia: SocialMediaEnum.instagram,
        username: 'testuser',
        price: 50,
        publicPrice: 100,
        followers: 5000,
        selectedContent: {
            campaignContentItemId: makeObjectId(),
            descriptionId: makeObjectId(),
        },
        confirmation: InfluencerConfirmationStatusEnum.accept,
        closePromo: InfluencerPromoClosedStatusEnum.wait,
        ...overrides,
    } as CampaignAccount);

    it('should map _id to addedAccountsId', () => {
        const id = makeObjectId();
        const account = makeSchemaAccount({ _id: id });

        const result = mapToICampaignAccount(account);

        expect(result.addedAccountsId).toBe(id);
    });

    it('should map accountId to socialAccountId', () => {
        const accountId = makeObjectId();
        const account = makeSchemaAccount({ accountId });

        const result = mapToICampaignAccount(account);

        expect(result.socialAccountId).toBe(accountId);
    });

    it('should use safeParseToNumber for followers', () => {
        const account = makeSchemaAccount({ followers: '3000' as any });

        const result = mapToICampaignAccount(account);

        expect(result.followers).toBe(3000);
    });

    it('should use safeParseToNumber for numeric stats fields', () => {
        const account = makeSchemaAccount({
            impressions: '1500' as any,
            like: '200' as any,
            comments: '50' as any,
            shares: '30' as any,
            saves: '10' as any,
            rating: '4.5' as any,
        });

        const result = mapToICampaignAccount(account);

        expect(result.impressions).toBe(1500);
        expect(result.like).toBe(200);
        expect(result.comments).toBe(50);
        expect(result.shares).toBe(30);
        expect(result.saves).toBe(10);
        expect(result.rating).toBe(4.5);
    });

    it('should set defaults for missing optional fields', () => {
        const account = makeSchemaAccount({
            dateRequest: undefined,
            datePost: undefined,
            postLink: undefined,
            screenshot: undefined,
        });

        const result = mapToICampaignAccount(account);

        expect(result.dateRequest).toBeNull();
        expect(result.datePost).toBeNull();
        expect(result.postLink).toBeNull();
        expect(result.screenshot).toBeNull();
    });

    it('should default confirmation to wait when not set', () => {
        const account = makeSchemaAccount({ confirmation: undefined });

        const result = mapToICampaignAccount(account);

        expect(result.confirmation).toBe(InfluencerConfirmationStatusEnum.wait);
    });

    it('should default closePromo to wait when not set', () => {
        const account = makeSchemaAccount({ closePromo: undefined });

        const result = mapToICampaignAccount(account);

        expect(result.closePromo).toBe(InfluencerPromoClosedStatusEnum.wait);
    });

    it('should pass through selectedContentItem when provided', () => {
        const selectedContentItem = {
            _id: makeObjectId(),
            socialMedia: SocialMediaEnum.instagram,
            socialMediaGroup: 'main',
            mainLink: 'https://example.com',
            description: 'Test',
        };
        const account = makeSchemaAccount();

        const result = mapToICampaignAccount(account, selectedContentItem);

        expect(result.selectedContentItem).toBe(selectedContentItem);
    });

    it('should set selectedContentItem to null by default', () => {
        const account = makeSchemaAccount();

        const result = mapToICampaignAccount(account);

        expect(result.selectedContentItem).toBeNull();
    });

    it('should include genres when present on account', () => {
        const account = makeSchemaAccount();
        (account as any).genres = ['rock', 'pop'];

        const result = mapToICampaignAccount(account);

        expect(result.genres).toEqual(['rock', 'pop']);
    });

    it('should include countries when present on account', () => {
        const account = makeSchemaAccount();
        (account as any).countries = [{ name: 'US' }];

        const result = mapToICampaignAccount(account);

        expect(result.countries).toEqual([{ name: 'US' }]);
    });

    it('should set logoUrl from account if available', () => {
        const account = makeSchemaAccount();
        (account as any).logoUrl = 'https://cdn.com/logo.png';

        const result = mapToICampaignAccount(account);

        expect(result.logoUrl).toBe('https://cdn.com/logo.png');
    });

    it('should set logoUrl to null when not present', () => {
        const account = makeSchemaAccount();

        const result = mapToICampaignAccount(account);

        expect(result.logoUrl).toBeNull();
    });
});

describe('mapToIAdminCampaignAccount', () => {
    const makeSchemaAccount = (overrides: Partial<CampaignAccount> = {}): CampaignAccount => ({
        _id: makeObjectId(),
        influencerId: makeObjectId(),
        accountId: makeObjectId(),
        socialMedia: SocialMediaEnum.instagram,
        username: 'admin_testuser',
        price: 50,
        publicPrice: 100,
        followers: 5000,
        selectedContent: {
            campaignContentItemId: makeObjectId(),
            descriptionId: makeObjectId(),
        },
        confirmation: InfluencerConfirmationStatusEnum.accept,
        closePromo: InfluencerPromoClosedStatusEnum.wait,
        ...overrides,
    } as CampaignAccount);

    it('should include cpm when provided', () => {
        const account = makeSchemaAccount();

        const result = mapToIAdminCampaignAccount(account, null, 5.123);

        expect(result.cpm).toBe(5.123);
    });

    it('should set cpm to undefined when null is passed', () => {
        const account = makeSchemaAccount();

        const result = mapToIAdminCampaignAccount(account, null, null);

        expect(result.cpm).toBeUndefined();
    });

    it('should map all base fields same as mapToICampaignAccount', () => {
        const id = makeObjectId();
        const accountId = makeObjectId();
        const account = makeSchemaAccount({ _id: id, accountId });

        const result = mapToIAdminCampaignAccount(account, null, 10);

        expect(result.addedAccountsId).toBe(id);
        expect(result.socialAccountId).toBe(accountId);
        expect(result.socialMedia).toBe(SocialMediaEnum.instagram);
        expect(result.username).toBe('admin_testuser');
    });
});

describe('mapProposalToIAdminCampaignDetails', () => {
    const makeProposalCampaign = (overrides: Partial<ProposalCampaign> = {}): ProposalCampaign => ({
        _id: makeObjectId(),
        schemaVersion: 2,
        creatorId: makeObjectId(),
        creatorRole: 'admin' as any,
        socialMedia: 'instagram',
        campaignName: 'Proposal Campaign',
        optionsIds: [makeObjectId()],
        hiddenColumns: ['cpm'],
        createdAt: new Date('2025-03-15'),
        ...overrides,
    } as ProposalCampaign);

    const makeProposalAccount = (overrides: Partial<ProposalCampaignAccount> = {}): ProposalCampaignAccount => ({
        _id: makeObjectId(),
        influencerId: makeObjectId(),
        accountId: makeObjectId(),
        socialMedia: SocialMediaEnum.instagram,
        username: 'proposal_user',
        price: 30,
        publicPrice: 60,
        followers: 2000,
        selectedContent: {
            campaignContentItemId: makeObjectId(),
            descriptionId: makeObjectId(),
        },
        confirmation: InfluencerConfirmationStatusEnum.wait,
        closePromo: InfluencerPromoClosedStatusEnum.wait,
        impressions: 0,
        like: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        genres: [],
        countries: [],
        ...overrides,
    } as any);

    const makeProposalOption = (overrides: Partial<ProposalCampaignOption> = {}): ProposalCampaignOption => ({
        _id: makeObjectId(),
        proposalCampaignId: makeObjectId(),
        creatorId: makeObjectId(),
        creatorRole: 'admin' as any,
        schemaVersion: 1,
        publicCampaignPrice: 500,
        privateCampaignPrice: 300,
        addedAccounts: [],
        campaignContent: [],
        ...overrides,
    } as ProposalCampaignOption);

    it('should set status to "proposal"', () => {
        const campaign = makeProposalCampaign();
        const option = makeProposalOption();

        const result = mapProposalToIAdminCampaignDetails(campaign, option);

        expect(result.status).toBe('proposal');
    });

    it('should use option.publicCampaignPrice as price', () => {
        const campaign = makeProposalCampaign();
        const option = makeProposalOption({ publicCampaignPrice: 750 });

        const result = mapProposalToIAdminCampaignDetails(campaign, option);

        expect(result.price).toBe(750);
    });

    it('should set shareLink to null', () => {
        const campaign = makeProposalCampaign();
        const option = makeProposalOption();

        const result = mapProposalToIAdminCampaignDetails(campaign, option);

        expect(result.shareLink).toBeNull();
    });

    it('should set canEdit to true', () => {
        const campaign = makeProposalCampaign();
        const option = makeProposalOption();

        const result = mapProposalToIAdminCampaignDetails(campaign, option);

        expect(result.canEdit).toBe(true);
    });

    it('should use campaign.hiddenColumns', () => {
        const campaign = makeProposalCampaign({ hiddenColumns: ['price', 'cpm'] });
        const option = makeProposalOption();

        const result = mapProposalToIAdminCampaignDetails(campaign, option);

        expect(result.hiddenColumns).toEqual(['price', 'cpm']);
    });

    it('should default hiddenColumns to empty array when not set', () => {
        const campaign = makeProposalCampaign({ hiddenColumns: undefined });
        const option = makeProposalOption();

        const result = mapProposalToIAdminCampaignDetails(campaign, option);

        expect(result.hiddenColumns).toEqual([]);
    });

    it('should compute totals from addedAccounts', () => {
        const acc1 = makeProposalAccount({
            followers: 1000,
            impressions: 500,
            like: 50,
            saves: 10,
            comments: 5,
            shares: 3,
        });
        const acc2 = makeProposalAccount({
            followers: 2000,
            impressions: 800,
            like: 80,
            saves: 20,
            comments: 8,
            shares: 4,
        });

        const campaign = makeProposalCampaign();
        const option = makeProposalOption({ addedAccounts: [acc1, acc2] });

        const result = mapProposalToIAdminCampaignDetails(campaign, option);

        expect(result.totalFollowers).toBe(3000);
        expect(result.totalImpressions).toBe(1300);
        expect(result.totalLikes).toBe(130);
        expect(result.totalSaves).toBe(30);
        expect(result.totalComments).toBe(13);
        expect(result.totalShares).toBe(7);
    });

    it('should compute overall CPM from price and total impressions', () => {
        const acc = makeProposalAccount({ impressions: 1000 });
        const campaign = makeProposalCampaign();
        const option = makeProposalOption({
            publicCampaignPrice: 500,
            addedAccounts: [acc],
        });

        const result = mapProposalToIAdminCampaignDetails(campaign, option);

        expect(result.cpm).toBe(500);
    });

    it('should set overall CPM to null when totalImpressions is 0', () => {
        const acc = makeProposalAccount({ impressions: 0 });
        const campaign = makeProposalCampaign();
        const option = makeProposalOption({ addedAccounts: [acc] });

        const result = mapProposalToIAdminCampaignDetails(campaign, option);

        expect(result.cpm).toBeNull();
    });

    it('should compute per-account CPM in addedAccounts', () => {
        const acc = makeProposalAccount({
            publicPrice: 100,
            impressions: 2000,
        });
        const campaign = makeProposalCampaign();
        const option = makeProposalOption({ addedAccounts: [acc] });

        const result = mapProposalToIAdminCampaignDetails(campaign, option);

        expect(result.addedAccounts[0].cpm).toBe(50);
    });

    it('should set per-account CPM to undefined when account impressions is 0', () => {
        const acc = makeProposalAccount({
            publicPrice: 100,
            impressions: 0,
        });
        const campaign = makeProposalCampaign();
        const option = makeProposalOption({ addedAccounts: [acc] });

        const result = mapProposalToIAdminCampaignDetails(campaign, option);

        expect(result.addedAccounts[0].cpm).toBeUndefined();
    });

    it('should handle empty addedAccounts', () => {
        const campaign = makeProposalCampaign();
        const option = makeProposalOption({ addedAccounts: [] });

        const result = mapProposalToIAdminCampaignDetails(campaign, option);

        expect(result.addedAccounts).toEqual([]);
        expect(result.totalFollowers).toBe(0);
        expect(result.totalImpressions).toBe(0);
        expect(result.cpm).toBeNull();
    });

    it('should set isCpmAndResultHidden and isPriceHidden to false', () => {
        const campaign = makeProposalCampaign();
        const option = makeProposalOption();

        const result = mapProposalToIAdminCampaignDetails(campaign, option);

        expect(result.isCpmAndResultHidden).toBe(false);
        expect(result.isPriceHidden).toBe(false);
    });

    it('should use campaign._id and campaignName', () => {
        const id = makeObjectId();
        const campaign = makeProposalCampaign({
            _id: id,
            campaignName: 'My Proposal',
        });
        const option = makeProposalOption();

        const result = mapProposalToIAdminCampaignDetails(campaign, option);

        expect(result._id).toBe(id);
        expect(result.campaignName).toBe('My Proposal');
    });

    it('should default campaignName to "OLD CAMPAIGN" when null', () => {
        const campaign = makeProposalCampaign({ campaignName: undefined });
        const option = makeProposalOption();

        const result = mapProposalToIAdminCampaignDetails(campaign, option);

        expect(result.campaignName).toBe('OLD CAMPAIGN');
    });

    it('should use option.campaignContent', () => {
        const contentItem = {
            _id: makeObjectId(),
            socialMedia: SocialMediaEnum.instagram,
            socialMediaGroup: 'main',
            mainLink: 'https://example.com',
        };
        const campaign = makeProposalCampaign();
        const option = makeProposalOption({ campaignContent: [contentItem as any] });

        const result = mapProposalToIAdminCampaignDetails(campaign, option);

        expect(result.campaignContent).toEqual([contentItem]);
    });
});

describe('mapToAdminCampaignDetailsDto', () => {
    const makeAdminCampaignDetails = () => {
        const id = makeObjectId();
        const accountId = makeObjectId();
        const socialAccountId = makeObjectId();
        const influencerId = makeObjectId();
        const contentItemId = makeObjectId();
        const descriptionId = makeObjectId();
        const createdAt = new Date('2025-06-15');

        return {
            _id: id,
            campaignName: 'Admin Campaign',
            socialMedia: 'instagram' as const,
            createdAt,
            price: 1000,
            status: CampaignStatusEnum.distributing,
            addedAccounts: [{
                addedAccountsId: accountId,
                socialAccountId,
                influencerId,
                socialMedia: SocialMediaEnum.instagram,
                username: 'admin_user',
                publicPrice: 200,
                followers: 10000,
                selectedContent: {
                    campaignContentItemId: contentItemId,
                    descriptionId,
                },
                selectedContentItem: {
                    _id: contentItemId,
                    socialMedia: SocialMediaEnum.instagram,
                    socialMediaGroup: 'main',
                    mainLink: 'https://example.com',
                    description: 'Test',
                },
                confirmation: InfluencerConfirmationStatusEnum.accept,
                closePromo: InfluencerPromoClosedStatusEnum.wait,
                impressions: 5000,
                like: 100,
                cpm: 40,
            }],
            campaignContent: [],
            shareLink: 'https://share.example.com',
            totalFollowers: 10000,
            totalImpressions: 5000,
            totalLikes: 100,
            totalSaves: 50,
            totalComments: 20,
            totalShares: 10,
            isCpmAndResultHidden: false,
            isPriceHidden: false,
            canEdit: true,
            hiddenColumns: [],
            cpm: 200,
        };
    };

    it('should convert _id to string campaignId', () => {
        const details = makeAdminCampaignDetails();

        const result = mapToAdminCampaignDetailsDto(details as any);

        expect(result.campaignId).toBe(details._id.toString());
    });

    it('should format createdAt using formatDate', () => {
        const details = makeAdminCampaignDetails();

        const result = mapToAdminCampaignDetailsDto(details as any);

        expect(result.creationDate).toBe(formatDate(details.createdAt));
    });

    it('should convert addedAccounts ObjectId fields to strings', () => {
        const details = makeAdminCampaignDetails();

        const result = mapToAdminCampaignDetailsDto(details as any);

        const acc = result.addedAccounts[0];
        expect(typeof acc.addedAccountsId).toBe('string');
        expect(typeof acc.socialAccountId).toBe('string');
        expect(typeof acc.influencerId).toBe('string');
        expect(typeof acc.selectedContent.campaignContentItemId).toBe('string');
        expect(typeof acc.selectedContent.descriptionId).toBe('string');
        expect(typeof acc.selectedContentItem._id).toBe('string');
    });

    it('should preserve cpm on accounts when present', () => {
        const details = makeAdminCampaignDetails();
        details.addedAccounts[0].cpm = 42.5;

        const result = mapToAdminCampaignDetailsDto(details as any);

        expect(result.addedAccounts[0].cpm).toBe(42.5);
    });

    it('should preserve scalar fields', () => {
        const details = makeAdminCampaignDetails();

        const result = mapToAdminCampaignDetailsDto(details as any);

        expect(result.campaignName).toBe('Admin Campaign');
        expect(result.socialMedia).toBe('instagram');
        expect(result.price).toBe(1000);
        expect(result.status).toBe(CampaignStatusEnum.distributing);
        expect(result.totalFollowers).toBe(10000);
        expect(result.totalImpressions).toBe(5000);
        expect(result.isCpmAndResultHidden).toBe(false);
        expect(result.isPriceHidden).toBe(false);
        expect(result.canEdit).toBe(true);
        expect(result.cpm).toBe(200);
    });

    it('should default hiddenColumns to empty array when not set', () => {
        const details = makeAdminCampaignDetails();
        delete (details as any).hiddenColumns;

        const result = mapToAdminCampaignDetailsDto(details as any);

        expect(result.hiddenColumns).toEqual([]);
    });
});
