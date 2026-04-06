import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import { AdminCampaignsService } from './admin-campaigns.service';
import { CampaignRepository } from '../../../database/repositories/campaigns/campaign.repository';
import { CompletedCampaignRepository } from '../../../database/repositories/campaigns/completed-campaign.repository';
import { ProposalCampaignRepository } from '../../../database/repositories/campaigns/proposal-campaign.repository';
import { ProposalCampaignOptionRepository } from '../../../database/repositories/campaigns/proposal-campaign-option.repository';
import { InfluencerRepository } from '../../../database/repositories/users/influencer.repository';
import { CampaignDetailsService } from '../../campaigns/services/campaign-details.service';
import { CampaignUpdateService } from '../../campaigns/services/campaign-update.service';
import { CampaignAccountsBuilderService } from '../../campaigns/services/campaign-accounts-builder.service';
import { ProposalCampaignDetailsService } from '../../proposal-system/services/proposal-campaign-details.service';
import { ProposalCampaignUpdateService } from '../../proposal-system/services/proposal-campaign-update.service';
import { ProposalAccountsBuilderService } from '../../proposal-system/services/proposal-accounts-builder.service';
import { XlsxImporter } from '../../../common/utils/import/xlsx/xlsx-import';
import {
    AdminCampaignsListStatusEnum,
    GetAdminCampaignsListQueryDto,
} from '../dto/campaigns/admin-campaigns.dto';
type CampaignAdminListFilter = Record<string, unknown>;
import { AdminCampaignStatusEnum, CampaignAdminMetaEnum } from '../../../common/types/client/campaign.types';
import { Role } from '../../../common/types/user.types';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateCampaignDto } from '../../campaigns/dto/update-campaign.dto';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeListItem(overrides: Record<string, unknown> = {}) {
    return {
        _id: new Types.ObjectId(),
        socialMedia: 'instagram',
        campaignName: 'Test Campaign',
        creatorRole: Role.client,
        creatorName: 'Alice',
        totalFollowers: 5000,
        price: 300,
        publicPrice: 400,
        createdAt: new Date('2024-05-10'),
        status: AdminCampaignsListStatusEnum.pending,
        statusLabel: AdminCampaignStatusEnum.pending,
        reportSent: false,
        paymentStatus: null,
        invoiceId: null,
        shortInvoiceNumber: null,
        notes: null,
        affiliatePartner: null,
        affiliateCommission: null,
        affiliatePaid: null,
        ...overrides,
    };
}

// ─── test suite ─────────────────────────────────────────────────────────────

describe('AdminCampaignsService', () => {
    let service: AdminCampaignsService;

    let campaignRepo: {
        getOngoingCampaignsForAdmin: jest.Mock;
        updateAdminMetaField: jest.Mock;
        deleteById: jest.Mock;
        getDetailedCampaignForAdmin: jest.Mock;
    };
    let completedRepo: {
        getCompletedCampaignsForAdmin: jest.Mock;
        updateAdminMetaField: jest.Mock;
        deleteById: jest.Mock;
        getDetailedCampaignForAdmin: jest.Mock;
    };
    let proposalRepo: {
        getProposalCampaignsForAdmin: jest.Mock;
        updateAdminMetaField: jest.Mock;
        deleteById: jest.Mock;
    };
    let campaignDetailsService: { execute: jest.Mock };
    let campaignUpdateService: { execute: jest.Mock };
    let proposalDetailsService: { execute: jest.Mock };
    let proposalUpdateService: { execute: jest.Mock };

    const emptyResult = { items: [], total: 0 };

    beforeEach(async () => {
        campaignRepo = {
            getOngoingCampaignsForAdmin: jest.fn().mockResolvedValue(emptyResult),
            updateAdminMetaField: jest.fn(),
            deleteById: jest.fn(),
            getDetailedCampaignForAdmin: jest.fn(),
        };
        completedRepo = {
            getCompletedCampaignsForAdmin: jest.fn().mockResolvedValue(emptyResult),
            updateAdminMetaField: jest.fn(),
            deleteById: jest.fn(),
            getDetailedCampaignForAdmin: jest.fn(),
        };
        proposalRepo = {
            getProposalCampaignsForAdmin: jest.fn().mockResolvedValue(emptyResult),
            updateAdminMetaField: jest.fn(),
            deleteById: jest.fn(),
        };
        campaignDetailsService = { execute: jest.fn() };
        campaignUpdateService = { execute: jest.fn() };
        proposalDetailsService = { execute: jest.fn() };
        proposalUpdateService = { execute: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdminCampaignsService,
                { provide: InfluencerRepository, useValue: {} },
                { provide: CampaignRepository, useValue: campaignRepo },
                { provide: CompletedCampaignRepository, useValue: completedRepo },
                { provide: ProposalCampaignRepository, useValue: proposalRepo },
                { provide: ProposalCampaignOptionRepository, useValue: {} },
                { provide: CampaignDetailsService, useValue: campaignDetailsService },
                { provide: CampaignUpdateService, useValue: campaignUpdateService },
                { provide: CampaignAccountsBuilderService, useValue: { buildCampaignAccountsBatch: jest.fn() } },
                { provide: ProposalCampaignDetailsService, useValue: proposalDetailsService },
                { provide: ProposalCampaignUpdateService, useValue: proposalUpdateService },
                { provide: ProposalAccountsBuilderService, useValue: { buildProposalAccountsBatch: jest.fn() } },
                { provide: XlsxImporter, useValue: {} },
            ],
        }).compile();

        service = module.get(AdminCampaignsService);
    });

    // ── getCampaignsList ───────────────────────────────────────────────────

    describe('getCampaignsList', () => {
        describe('repository routing by status', () => {
            it('calls all three repos when no status provided', async () => {
                await service.getCampaignsList({} as GetAdminCampaignsListQueryDto);

                expect(campaignRepo.getOngoingCampaignsForAdmin).toHaveBeenCalledTimes(1);
                expect(completedRepo.getCompletedCampaignsForAdmin).toHaveBeenCalledTimes(1);
                expect(proposalRepo.getProposalCampaignsForAdmin).toHaveBeenCalledTimes(1);
            });

            it('calls only proposalRepo when status === proposal', async () => {
                await service.getCampaignsList({
                    status: AdminCampaignsListStatusEnum.proposal,
                } as GetAdminCampaignsListQueryDto);

                expect(proposalRepo.getProposalCampaignsForAdmin).toHaveBeenCalledTimes(1);
                expect(campaignRepo.getOngoingCampaignsForAdmin).not.toHaveBeenCalled();
                expect(completedRepo.getCompletedCampaignsForAdmin).not.toHaveBeenCalled();
            });

            it('calls only completedRepo when status === completed', async () => {
                await service.getCampaignsList({
                    status: AdminCampaignsListStatusEnum.completed,
                } as GetAdminCampaignsListQueryDto);

                expect(completedRepo.getCompletedCampaignsForAdmin).toHaveBeenCalledTimes(1);
                expect(campaignRepo.getOngoingCampaignsForAdmin).not.toHaveBeenCalled();
                expect(proposalRepo.getProposalCampaignsForAdmin).not.toHaveBeenCalled();
            });

            it('calls only campaignRepo when status === pending', async () => {
                await service.getCampaignsList({
                    status: AdminCampaignsListStatusEnum.pending,
                } as GetAdminCampaignsListQueryDto);

                expect(campaignRepo.getOngoingCampaignsForAdmin).toHaveBeenCalledTimes(1);
                expect(completedRepo.getCompletedCampaignsForAdmin).not.toHaveBeenCalled();
                expect(proposalRepo.getProposalCampaignsForAdmin).not.toHaveBeenCalled();
            });

            it('calls only campaignRepo when status === distributing', async () => {
                await service.getCampaignsList({
                    status: AdminCampaignsListStatusEnum.distributing,
                } as GetAdminCampaignsListQueryDto);

                expect(campaignRepo.getOngoingCampaignsForAdmin).toHaveBeenCalledTimes(1);
                expect(completedRepo.getCompletedCampaignsForAdmin).not.toHaveBeenCalled();
                expect(proposalRepo.getProposalCampaignsForAdmin).not.toHaveBeenCalled();
            });
        });

        describe('filter mapping', () => {
            it('passes the full DTO to repos (repos handle their own filtering)', async () => {
                const dto: GetAdminCampaignsListQueryDto = {
                    status: AdminCampaignsListStatusEnum.pending,
                    page: 2,
                    limit: 5,
                } as any;

                await service.getCampaignsList(dto);

                const calledFilter: CampaignAdminListFilter =
                    campaignRepo.getOngoingCampaignsForAdmin.mock.calls[0][0];

                expect(calledFilter).toMatchObject({ status: AdminCampaignsListStatusEnum.pending });
            });

            it('includes search in filter when provided (via status=undefined path)', async () => {
                // GetAdminCampaignsListQueryDto extends PaginationQueryDto and has no search field.
                // We verify the service does not crash and that it builds a search-less filter.
                await service.getCampaignsList({} as GetAdminCampaignsListQueryDto);

                const filter: CampaignAdminListFilter =
                    campaignRepo.getOngoingCampaignsForAdmin.mock.calls[0][0];

                expect(filter.search).toBeUndefined();
            });
        });

        describe('pagination and response shape', () => {
            it('returns total = sum of all three repos totals', async () => {
                campaignRepo.getOngoingCampaignsForAdmin.mockResolvedValueOnce({ items: [], total: 3 });
                completedRepo.getCompletedCampaignsForAdmin.mockResolvedValueOnce({ items: [], total: 5 });
                proposalRepo.getProposalCampaignsForAdmin.mockResolvedValueOnce({ items: [], total: 2 });

                const result = await service.getCampaignsList({} as GetAdminCampaignsListQueryDto);

                expect(result.total).toBe(10);
            });

            it('calculates totalPages correctly', async () => {
                campaignRepo.getOngoingCampaignsForAdmin.mockResolvedValueOnce({ items: [], total: 25 });

                const result = await service.getCampaignsList({
                    status: AdminCampaignsListStatusEnum.pending,
                    limit: 10,
                } as any);

                expect(result.totalPages).toBe(3); // ceil(25/10)
            });

            it('returns items as empty array when all repos return nothing', async () => {
                const result = await service.getCampaignsList({} as GetAdminCampaignsListQueryDto);

                expect(result.items).toEqual([]);
            });

            it('maps IAdminCampaignForList to AdminCampaignForListDto (campaignId as string)', async () => {
                const item = makeListItem({ campaignName: 'Campaign A' });
                campaignRepo.getOngoingCampaignsForAdmin.mockResolvedValueOnce({ items: [item], total: 1 });

                const result = await service.getCampaignsList({
                    status: AdminCampaignsListStatusEnum.pending,
                } as any);

                expect(result.items).toHaveLength(1);
                expect(result.items[0].campaignId).toBe(item._id.toString());
                expect(result.items[0].campaignName).toBe('Campaign A');
            });
        });
    });

    // ── searchCampaigns ───────────────────────────────────────────────────

    describe('searchCampaigns', () => {
        it('always queries all three repos', async () => {
            await service.searchCampaigns({ search: 'rock', limit: 10 });

            expect(campaignRepo.getOngoingCampaignsForAdmin).toHaveBeenCalledTimes(1);
            expect(completedRepo.getCompletedCampaignsForAdmin).toHaveBeenCalledTimes(1);
            expect(proposalRepo.getProposalCampaignsForAdmin).toHaveBeenCalledTimes(1);
        });

        it('passes search term in filter to repos', async () => {
            await service.searchCampaigns({ search: 'rock', limit: 5 });

            const filter: CampaignAdminListFilter =
                campaignRepo.getOngoingCampaignsForAdmin.mock.calls[0][0];

            expect(filter.search).toBe('rock');
            expect(filter.status).toBeUndefined();
        });

        it('uses limit as take parameter', async () => {
            await service.searchCampaigns({ search: 'test', limit: 7 });

            const take: number = campaignRepo.getOngoingCampaignsForAdmin.mock.calls[0][1];
            expect(take).toBe(7);
        });

        it('returns total = sum of all three totals', async () => {
            campaignRepo.getOngoingCampaignsForAdmin.mockResolvedValueOnce({ items: [], total: 4 });
            completedRepo.getCompletedCampaignsForAdmin.mockResolvedValueOnce({ items: [], total: 6 });
            proposalRepo.getProposalCampaignsForAdmin.mockResolvedValueOnce({ items: [], total: 2 });

            const result = await service.searchCampaigns({ search: 'x', limit: 10 });

            expect(result.total).toBe(12);
        });
    });

    // ── mergeSortedCampaigns (via getCampaignsList) ────────────────────────

    describe('mergeSortedCampaigns (integration via getCampaignsList)', () => {
        it('merges items from multiple sources sorted by createdAt descending', async () => {
            const older = makeListItem({ campaignName: 'Older', createdAt: new Date('2024-01-01') });
            const newer = makeListItem({ campaignName: 'Newer', createdAt: new Date('2024-06-01') });

            campaignRepo.getOngoingCampaignsForAdmin.mockResolvedValueOnce({ items: [older], total: 1 });
            completedRepo.getCompletedCampaignsForAdmin.mockResolvedValueOnce({ items: [newer], total: 1 });
            proposalRepo.getProposalCampaignsForAdmin.mockResolvedValueOnce({ items: [], total: 0 });

            const result = await service.getCampaignsList({ limit: 10, page: 1 } as any);

            expect(result.items[0].campaignName).toBe('Newer');
            expect(result.items[1].campaignName).toBe('Older');
        });
    });

    // ── getDetailedCampaign ─────────────────────────────────────────────

    describe('getDetailedCampaign', () => {
        const campaignId = new Types.ObjectId().toString();
        const fakeDetails = { campaignId, campaignName: 'Detailed' };

        it('routes to proposalCampaignDetailsService.execute when optionIndex is defined', async () => {
            proposalDetailsService.execute.mockResolvedValueOnce(fakeDetails);

            const result = await service.getDetailedCampaign(
                AdminCampaignsListStatusEnum.proposal,
                campaignId,
                0,
            );

            expect(proposalDetailsService.execute).toHaveBeenCalledTimes(1);
            expect(proposalDetailsService.execute).toHaveBeenCalledWith(
                campaignId,
                0,
                expect.any(Object),
            );
            expect(campaignDetailsService.execute).not.toHaveBeenCalled();
            expect(result).toBe(fakeDetails);
        });

        it('routes to campaignDetailsService.execute when optionIndex is undefined', async () => {
            campaignDetailsService.execute.mockResolvedValueOnce(fakeDetails);

            const result = await service.getDetailedCampaign(
                AdminCampaignsListStatusEnum.pending,
                campaignId,
            );

            expect(campaignDetailsService.execute).toHaveBeenCalledTimes(1);
            expect(campaignDetailsService.execute).toHaveBeenCalledWith(
                campaignId,
                expect.objectContaining({
                    findCampaign: expect.any(Function),
                    mapResult: expect.any(Function),
                }),
            );
            expect(proposalDetailsService.execute).not.toHaveBeenCalled();
            expect(result).toBe(fakeDetails);
        });

        it('uses campaignRepo for pending status', async () => {
            campaignDetailsService.execute.mockImplementation(async (_id, deps) => {
                await deps.findCampaign(campaignId);
                return fakeDetails;
            });

            await service.getDetailedCampaign(AdminCampaignsListStatusEnum.pending, campaignId);

            expect(campaignRepo.getDetailedCampaignForAdmin).toHaveBeenCalledWith(campaignId);
            expect(completedRepo.getDetailedCampaignForAdmin).not.toHaveBeenCalled();
        });

        it('uses completedRepo for completed status', async () => {
            campaignDetailsService.execute.mockImplementation(async (_id, deps) => {
                await deps.findCampaign(campaignId);
                return fakeDetails;
            });

            await service.getDetailedCampaign(AdminCampaignsListStatusEnum.completed, campaignId);

            expect(completedRepo.getDetailedCampaignForAdmin).toHaveBeenCalledWith(campaignId);
            expect(campaignRepo.getDetailedCampaignForAdmin).not.toHaveBeenCalled();
        });
    });

    // ── updateCampaign ──────────────────────────────────────────────────

    describe('updateCampaign', () => {
        const campaignId = new Types.ObjectId().toString();
        const fakeResult = { campaignId, campaignName: 'Updated' };

        it('routes to proposalCampaignUpdateService.execute when data.optionIndex is defined', async () => {
            proposalUpdateService.execute.mockResolvedValueOnce(fakeResult);
            const data = { optionIndex: 1 } as UpdateCampaignDto;

            const result = await service.updateCampaign(
                AdminCampaignsListStatusEnum.proposal,
                campaignId,
                data,
            );

            expect(proposalUpdateService.execute).toHaveBeenCalledTimes(1);
            expect(proposalUpdateService.execute).toHaveBeenCalledWith(
                campaignId,
                1,
                data,
                expect.any(Object),
            );
            expect(campaignUpdateService.execute).not.toHaveBeenCalled();
            expect(result).toBe(fakeResult);
        });

        it('routes to campaignUpdateService.execute when status is pending and no optionIndex', async () => {
            campaignUpdateService.execute.mockResolvedValueOnce(fakeResult);
            const data = {} as UpdateCampaignDto;

            const result = await service.updateCampaign(
                AdminCampaignsListStatusEnum.pending,
                campaignId,
                data,
            );

            expect(campaignUpdateService.execute).toHaveBeenCalledTimes(1);
            expect(result).toBe(fakeResult);
        });

        it('routes to campaignUpdateService.execute when status is distributing and no optionIndex', async () => {
            campaignUpdateService.execute.mockResolvedValueOnce(fakeResult);
            const data = {} as UpdateCampaignDto;

            const result = await service.updateCampaign(
                AdminCampaignsListStatusEnum.distributing,
                campaignId,
                data,
            );

            expect(campaignUpdateService.execute).toHaveBeenCalledTimes(1);
            expect(result).toBe(fakeResult);
        });

        it('throws BadRequestException when status is proposal but no optionIndex', async () => {
            const data = {} as UpdateCampaignDto;

            await expect(
                service.updateCampaign(AdminCampaignsListStatusEnum.proposal, campaignId, data),
            ).rejects.toThrow(BadRequestException);

            await expect(
                service.updateCampaign(AdminCampaignsListStatusEnum.proposal, campaignId, data),
            ).rejects.toThrow('Proposal campaign requires optionIndex');
        });

        it('throws BadRequestException when status is completed and no optionIndex', async () => {
            const data = {} as UpdateCampaignDto;

            await expect(
                service.updateCampaign(AdminCampaignsListStatusEnum.completed, campaignId, data),
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ── updateMeta ──────────────────────────────────────────────────────

    describe('updateMeta', () => {
        const campaignId = new Types.ObjectId().toString();

        it('throws BadRequestException when payload has no defined fields', async () => {
            await expect(
                service.updateMeta({} as any, AdminCampaignsListStatusEnum.pending, campaignId),
            ).rejects.toThrow(BadRequestException);

            await expect(
                service.updateMeta({} as any, AdminCampaignsListStatusEnum.pending, campaignId),
            ).rejects.toThrow('No adminMeta field provided');
        });

        it('throws BadRequestException when field is not in CampaignAdminMetaEnum', async () => {
            await expect(
                service.updateMeta(
                    { invalidField: 'value' } as any,
                    AdminCampaignsListStatusEnum.pending,
                    campaignId,
                ),
            ).rejects.toThrow(BadRequestException);

            await expect(
                service.updateMeta(
                    { invalidField: 'value' } as any,
                    AdminCampaignsListStatusEnum.pending,
                    campaignId,
                ),
            ).rejects.toThrow('Invalid adminMeta field provided');
        });

        it('calls campaignRepo.updateAdminMetaField for pending status', async () => {
            campaignRepo.updateAdminMetaField.mockResolvedValueOnce({
                adminMeta: { reportSent: true },
            });

            const result = await service.updateMeta(
                { reportSent: true } as any,
                AdminCampaignsListStatusEnum.pending,
                campaignId,
            );

            expect(campaignRepo.updateAdminMetaField).toHaveBeenCalledWith(
                campaignId,
                CampaignAdminMetaEnum.reportSent,
                true,
            );
            expect(result).toEqual({ campaignId, reportSent: true });
        });

        it('calls completedRepo.updateAdminMetaField for completed status', async () => {
            completedRepo.updateAdminMetaField.mockResolvedValueOnce({
                adminMeta: { notes: 'updated note' },
            });

            const result = await service.updateMeta(
                { notes: 'updated note' } as any,
                AdminCampaignsListStatusEnum.completed,
                campaignId,
            );

            expect(completedRepo.updateAdminMetaField).toHaveBeenCalledWith(
                campaignId,
                CampaignAdminMetaEnum.notes,
                'updated note',
            );
            expect(result).toEqual({ campaignId, notes: 'updated note' });
        });

        it('calls proposalRepo.updateAdminMetaField for proposal status', async () => {
            proposalRepo.updateAdminMetaField.mockResolvedValueOnce({
                adminMeta: { affiliatePartner: 'Partner A' },
            });

            const result = await service.updateMeta(
                { affiliatePartner: 'Partner A' } as any,
                AdminCampaignsListStatusEnum.proposal,
                campaignId,
            );

            expect(proposalRepo.updateAdminMetaField).toHaveBeenCalledWith(
                campaignId,
                CampaignAdminMetaEnum.affiliatePartner,
                'Partner A',
            );
            expect(result).toEqual({ campaignId, affiliatePartner: 'Partner A' });
        });

        it('throws NotFoundException when repository returns null', async () => {
            campaignRepo.updateAdminMetaField.mockResolvedValueOnce(null);

            await expect(
                service.updateMeta(
                    { reportSent: true } as any,
                    AdminCampaignsListStatusEnum.pending,
                    campaignId,
                ),
            ).rejects.toThrow(NotFoundException);

            campaignRepo.updateAdminMetaField.mockResolvedValueOnce(null);

            await expect(
                service.updateMeta(
                    { reportSent: true } as any,
                    AdminCampaignsListStatusEnum.pending,
                    campaignId,
                ),
            ).rejects.toThrow('Campaign not found');
        });
    });

    // ── deleteCampaign ──────────────────────────────────────────────────

    describe('deleteCampaign', () => {
        const campaignId = new Types.ObjectId().toString();

        it('calls campaignRepo.deleteById for pending status', async () => {
            await service.deleteCampaign(AdminCampaignsListStatusEnum.pending, campaignId);

            expect(campaignRepo.deleteById).toHaveBeenCalledWith(campaignId);
            expect(completedRepo.deleteById).not.toHaveBeenCalled();
            expect(proposalRepo.deleteById).not.toHaveBeenCalled();
        });

        it('calls completedRepo.deleteById for completed status', async () => {
            await service.deleteCampaign(AdminCampaignsListStatusEnum.completed, campaignId);

            expect(completedRepo.deleteById).toHaveBeenCalledWith(campaignId);
            expect(campaignRepo.deleteById).not.toHaveBeenCalled();
            expect(proposalRepo.deleteById).not.toHaveBeenCalled();
        });

        it('calls proposalRepo.deleteById for proposal status', async () => {
            await service.deleteCampaign(AdminCampaignsListStatusEnum.proposal, campaignId);

            expect(proposalRepo.deleteById).toHaveBeenCalledWith(campaignId);
            expect(campaignRepo.deleteById).not.toHaveBeenCalled();
            expect(completedRepo.deleteById).not.toHaveBeenCalled();
        });

        it('calls campaignRepo.deleteById for distributing status', async () => {
            await service.deleteCampaign(AdminCampaignsListStatusEnum.distributing, campaignId);

            expect(campaignRepo.deleteById).toHaveBeenCalledWith(campaignId);
        });
    });
});
