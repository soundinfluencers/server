import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { CampaignsService } from './campaigns.service';
import { ClientRepository } from '../../../database/repositories/users/client.repository';
import { InfluencerRepository } from '../../../database/repositories/users/influencer.repository';
import { CampaignRepository } from '../../../database/repositories/campaigns/campaign.repository';
import { DraftCampaignRepository } from '../../../database/repositories/campaigns/draft-campaign.repository';
import { CompletedCampaignRepository } from '../../../database/repositories/campaigns/completed-campaign.repository';
import { ProposalCampaignRepository } from '../../../database/repositories/campaigns/proposal-campaign.repository';
import { BespokeCampaignRepository } from '../../../database/repositories/campaigns/bespoke-campaign.repository';
import { MediaService } from '../../media/media.service';
import { InvoiceService } from '../../invoice/invoice.service';
import { InfluencerActionsHistoryService } from '../../influencer-actions-history/influencer-actions-history.service';
import { EmailService } from '../../../integrations/email/email.service';
import { CampaignDetailsService } from './campaign-details.service';
import { CampaignUpdateService } from './campaign-update.service';
import { CampaignAccountsBuilderService } from './campaign-accounts-builder.service';
import {
    CampaignConfirmationEnum,
    CampaignStatusEnum,
    CampaignTypeEnumForDevelopment,
} from '../../../common/types/client/campaign.types';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeOid() {
    return new Types.ObjectId();
}

/** Minimal IDashboardCampaign-shaped object returned by repo mocks */
function makeRawCampaign(overrides: Record<string, unknown> = {}) {
    return {
        _id: makeOid(),
        campaignName: 'Test Campaign',
        socialMedia: 'instagram',
        createdAt: new Date('2024-03-01'),
        campaignPrice: 250,
        clientStatus: 'distributing',
        ...overrides,
    };
}

// ─── test suite ─────────────────────────────────────────────────────────────

describe('CampaignsService', () => {
    let service: CampaignsService;

    // per-test mocks — typed to only the methods we care about
    let clientRepo: { findById: jest.Mock };
    let campaignRepo: { getDashboardCampaigns: jest.Mock; getDashboardCampaignsAll: jest.Mock; aggregate: jest.Mock };
    let draftRepo: { getDashboardCampaigns: jest.Mock };
    let completedRepo: { getDashboardCampaigns: jest.Mock };
    let proposalRepo: { getDashboardCampaigns: jest.Mock };

    const CLIENT_ID = makeOid().toString();

    beforeEach(async () => {
        clientRepo = { findById: jest.fn().mockResolvedValue({ _id: CLIENT_ID }) };
        campaignRepo = {
            getDashboardCampaigns: jest.fn().mockResolvedValue([]),
            getDashboardCampaignsAll: jest.fn().mockResolvedValue([]),
            aggregate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
        };
        draftRepo = { getDashboardCampaigns: jest.fn().mockResolvedValue([]) };
        completedRepo = { getDashboardCampaigns: jest.fn().mockResolvedValue([]) };
        proposalRepo = { getDashboardCampaigns: jest.fn().mockResolvedValue([]) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CampaignsService,
                { provide: ClientRepository, useValue: clientRepo },
                { provide: InfluencerRepository, useValue: {} },
                { provide: CampaignRepository, useValue: campaignRepo },
                { provide: DraftCampaignRepository, useValue: draftRepo },
                { provide: CompletedCampaignRepository, useValue: completedRepo },
                { provide: ProposalCampaignRepository, useValue: proposalRepo },
                { provide: BespokeCampaignRepository, useValue: {} },
                { provide: MediaService, useValue: {} },
                { provide: InvoiceService, useValue: {} },
                { provide: InfluencerActionsHistoryService, useValue: {} },
                { provide: EmailService, useValue: {} },
                { provide: CampaignDetailsService, useValue: {} },
                { provide: CampaignUpdateService, useValue: {} },
                { provide: CampaignAccountsBuilderService, useValue: {} },
            ],
        }).compile();

        service = module.get(CampaignsService);
    });

    // ── getCampaignsList ───────────────────────────────────────────────────

    describe('getCampaignsList', () => {
        describe('input validation', () => {
            it('throws BadRequestException when limit is 0', async () => {
                await expect(
                    service.getCampaignsList({ clientId: CLIENT_ID, limit: 0 } as any),
                ).rejects.toThrow(BadRequestException);
            });

            it('throws BadRequestException when limit is negative', async () => {
                await expect(
                    service.getCampaignsList({ clientId: CLIENT_ID, limit: -5 } as any),
                ).rejects.toThrow(BadRequestException);
            });

            it('throws BadRequestException when limit is a float', async () => {
                await expect(
                    service.getCampaignsList({ clientId: CLIENT_ID, limit: 1.5 } as any),
                ).rejects.toThrow(BadRequestException);
            });

            it('throws BadRequestException when page is 0', async () => {
                await expect(
                    service.getCampaignsList({ clientId: CLIENT_ID, page: 0 } as any),
                ).rejects.toThrow(BadRequestException);
            });

            it('throws BadRequestException when page is negative', async () => {
                await expect(
                    service.getCampaignsList({ clientId: CLIENT_ID, page: -1 } as any),
                ).rejects.toThrow(BadRequestException);
            });

            it('does not throw for valid limit and page', async () => {
                await expect(
                    service.getCampaignsList({ clientId: CLIENT_ID, limit: 10, page: 2 } as any),
                ).resolves.toBeDefined();
            });
        });

        describe('client existence check', () => {
            it('throws NotFoundException when client does not exist', async () => {
                clientRepo.findById.mockResolvedValueOnce(null);

                await expect(
                    service.getCampaignsList({ clientId: CLIENT_ID } as any),
                ).rejects.toThrow(NotFoundException);
            });

            it('passes clientId to clientRepo.findById', async () => {
                await service.getCampaignsList({ clientId: CLIENT_ID } as any);

                expect(clientRepo.findById).toHaveBeenCalledWith(CLIENT_ID);
            });
        });

        describe('repository routing by status', () => {
            it('calls draftRepo for "draft" status', async () => {
                await service.getCampaignsList({
                    clientId: CLIENT_ID,
                    status: CampaignTypeEnumForDevelopment.draft,
                } as any);

                expect(draftRepo.getDashboardCampaigns).toHaveBeenCalledWith(
                    CLIENT_ID,
                    expect.any(Number),
                    expect.any(Number),
                );
                expect(campaignRepo.getDashboardCampaigns).not.toHaveBeenCalled();
            });

            it('calls campaignRepo with underReview filter for "under_review" status', async () => {
                await service.getCampaignsList({
                    clientId: CLIENT_ID,
                    status: CampaignTypeEnumForDevelopment.underReview,
                } as any);

                expect(campaignRepo.getDashboardCampaigns).toHaveBeenCalledWith(
                    CLIENT_ID,
                    expect.any(Number),
                    expect.any(Number),
                    [CampaignStatusEnum.underReview],
                    CampaignConfirmationEnum.wait,
                );
            });

            it('calls campaignRepo with pending+distributing filter for "distributing" status', async () => {
                await service.getCampaignsList({
                    clientId: CLIENT_ID,
                    status: CampaignTypeEnumForDevelopment.distributing,
                } as any);

                expect(campaignRepo.getDashboardCampaigns).toHaveBeenCalledWith(
                    CLIENT_ID,
                    expect.any(Number),
                    expect.any(Number),
                    [CampaignStatusEnum.pending, CampaignStatusEnum.distributing],
                    CampaignConfirmationEnum.accept,
                );
            });

            it('calls completedRepo for "closed" status', async () => {
                await service.getCampaignsList({
                    clientId: CLIENT_ID,
                    status: CampaignTypeEnumForDevelopment.closed,
                } as any);

                expect(completedRepo.getDashboardCampaigns).toHaveBeenCalledWith(
                    CLIENT_ID,
                    expect.any(Number),
                    expect.any(Number),
                );
                expect(campaignRepo.getDashboardCampaigns).not.toHaveBeenCalled();
            });

            it('calls proposalRepo for "proposal" status', async () => {
                await service.getCampaignsList({
                    clientId: CLIENT_ID,
                    status: CampaignTypeEnumForDevelopment.proposal,
                } as any);

                expect(proposalRepo.getDashboardCampaigns).toHaveBeenCalledWith(
                    CLIENT_ID,
                    expect.any(Number),
                    expect.any(Number),
                );
            });

            it('calls aggregate for "all" status', async () => {
                await service.getCampaignsList({
                    clientId: CLIENT_ID,
                    status: CampaignTypeEnumForDevelopment.all,
                } as any);

                expect(campaignRepo.aggregate).toHaveBeenCalledWith(
                    expect.any(Array),
                );
            });

            it('defaults to "all" when no status provided', async () => {
                await service.getCampaignsList({ clientId: CLIENT_ID } as any);

                expect(campaignRepo.aggregate).toHaveBeenCalled();
            });
        });

        describe('pagination', () => {
            it('computes skip = (page - 1) * limit and passes to repo', async () => {
                await service.getCampaignsList({
                    clientId: CLIENT_ID,
                    status: CampaignTypeEnumForDevelopment.closed,
                    page: 3,
                    limit: 5,
                } as any);

                expect(completedRepo.getDashboardCampaigns).toHaveBeenCalledWith(
                    CLIENT_ID,
                    5,  // limit
                    10, // skip = (3-1)*5
                );
            });
        });

        describe('response mapping', () => {
            it('maps repo result to DashboardCampaignDto shape', async () => {
                const raw = makeRawCampaign({
                    campaignName: 'My Gig',
                    socialMedia: 'tiktok',
                    clientStatus: 'distributing',
                    createdAt: new Date('2024-06-15'),
                });
                campaignRepo.aggregate.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([raw]) });

                const result = await service.getCampaignsList({
                    clientId: CLIENT_ID,
                    status: CampaignTypeEnumForDevelopment.all,
                } as any);

                expect(result).toHaveLength(1);
                expect(result[0]._id).toBe(raw._id.toString());
                expect(result[0].campaignName).toBe('My Gig');
                expect(result[0].socialMedia).toBe('tiktok');
                expect(result[0].status).toBe('distributing');
                expect(typeof result[0].creationDate).toBe('string');
            });

            it('picks price from campaignPrice first, then publicPrice, then price', async () => {
                const withCampaignPrice = makeRawCampaign({ campaignPrice: 100, publicPrice: 200, price: 300 });
                const withPublicOnly = makeRawCampaign({ campaignPrice: undefined, publicPrice: 200, price: 300 });
                const withPriceOnly = makeRawCampaign({ campaignPrice: undefined, publicPrice: undefined, price: 300 });

                campaignRepo.aggregate
                    .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([withCampaignPrice]) })
                    .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([withPublicOnly]) })
                    .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([withPriceOnly]) });

                const base = { clientId: CLIENT_ID, status: CampaignTypeEnumForDevelopment.all } as any;

                const [r1] = await service.getCampaignsList(base);
                const [r2] = await service.getCampaignsList(base);
                const [r3] = await service.getCampaignsList(base);

                expect(r1.price).toBe(100);
                expect(r2.price).toBe(200);
                expect(r3.price).toBe(300);
            });

            it('returns an empty array when repo returns nothing', async () => {
                campaignRepo.aggregate.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });

                const result = await service.getCampaignsList({
                    clientId: CLIENT_ID,
                    status: CampaignTypeEnumForDevelopment.all,
                } as any);

                expect(result).toEqual([]);
            });
        });
    });
});
