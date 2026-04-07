import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InfluencerRepository } from '../../database/repositories/users/influencer.repository';
import { UserInvoiceRepository } from '../../database/repositories/invoices/user-invoice.repository';
import { InvoiceDetailsRepository } from '../../database/repositories/invoices/invoice-details.repository';
import { CampaignRepository } from '../../database/repositories/campaigns/campaign.repository';
import { InfluencerActionsHistoryService } from '../influencer-actions-history/influencer-actions-history.service';
import { ProfileService } from '../profile/services/profile.service';
import { EmailService } from '../../integrations/email/email.service';
import { Role } from '../../common/types/user.types';
import { Types } from 'mongoose';

const fakeId = () => new Types.ObjectId().toHexString();

describe('InvoiceService', () => {
  let service: InvoiceService;
  let userInvoiceRepository: Record<string, jest.Mock>;
  let influencerRepo: Record<string, jest.Mock>;
  let invoiceDetailsRepo: Record<string, jest.Mock>;
  let profileService: Record<string, jest.Mock>;

  beforeEach(async () => {
    userInvoiceRepository = {
      aggregate: jest.fn(),
      findInvoiceById: jest.fn(),
      findOne: jest.fn(),
      createInfluencerInvoice: jest.fn(),
      createClientInvoice: jest.fn(),
      updateClientInvoiceById: jest.fn(),
    };

    influencerRepo = {
      findById: jest.fn(),
      startSession: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    invoiceDetailsRepo = {
      findOne: jest.fn(),
    };

    profileService = {
      getPaymentDetails: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: InfluencerRepository, useValue: influencerRepo },
        { provide: UserInvoiceRepository, useValue: userInvoiceRepository },
        { provide: InvoiceDetailsRepository, useValue: invoiceDetailsRepo },
        { provide: CampaignRepository, useValue: {} },
        { provide: InfluencerActionsHistoryService, useValue: {} },
        { provide: ProfileService, useValue: profileService },
        { provide: EmailService, useValue: {} },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getInvoices', () => {
    it('should call aggregate and return invoices', async () => {
      const mockInvoices = [{ invoiceId: '1', amount: 100 }];
      userInvoiceRepository.aggregate.mockResolvedValue(mockInvoices);

      const result = await service.getInvoices(
        { limit: 10, page: 1 },
        { _id: fakeId(), role: Role.client } as any,
      );

      expect(userInvoiceRepository.aggregate).toHaveBeenCalled();
      expect(result).toEqual(mockInvoices);
    });
  });

  describe('downloadInvoice', () => {
    it('should throw NotFoundException if invoice not found', async () => {
      userInvoiceRepository.findInvoiceById.mockResolvedValue(null);

      await expect(
        service.downloadInvoice('nonexistent', { _id: 'user1', role: Role.client } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not owner and not admin', async () => {
      userInvoiceRepository.findInvoiceById.mockResolvedValue({
        userId: { toString: () => 'owner123' },
      });

      await expect(
        service.downloadInvoice('inv1', { _id: 'other-user', role: Role.client } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getDetailedInvoice', () => {
    it('should throw ForbiddenException if influencer', async () => {
      await expect(
        service.getDetailedInvoice('inv1', { _id: 'user1', role: Role.influencer } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if invoice not found', async () => {
      userInvoiceRepository.findInvoiceById.mockResolvedValue(null);

      await expect(
        service.getDetailedInvoice('nonexistent', { _id: 'user1', role: Role.client } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateInvoice', () => {
    it('should throw BadRequestException if nothing to update', async () => {
      await expect(
        service.updateInvoice('inv1', {} as any, { _id: 'user1', role: Role.client } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if invoice not found', async () => {
      userInvoiceRepository.findInvoiceById.mockResolvedValue(null);

      await expect(
        service.updateInvoice(
          'inv1',
          { poNumber: 'PO-123' } as any,
          { _id: 'user1', role: Role.client } as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getInvoiceDraft', () => {
    it('should throw NotFoundException if influencer not found', async () => {
      influencerRepo.findById.mockResolvedValue(null);

      await expect(
        service.getInvoiceDraft({ _id: 'nonexistent', role: Role.influencer } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
