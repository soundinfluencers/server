import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';

describe('InvoiceController', () => {
  let controller: InvoiceController;
  let invoiceService: Record<string, jest.Mock>;

  beforeEach(async () => {
    invoiceService = {
      getInvoiceDraft: jest.fn(),
      createInfluencerInvoice: jest.fn(),
      getInvoices: jest.fn(),
      getDetailedInvoice: jest.fn(),
      updateInvoice: jest.fn(),
      downloadInvoice: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceController],
      providers: [
        { provide: InvoiceService, useValue: invoiceService },
      ],
    }).compile();

    controller = module.get<InvoiceController>(InvoiceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDraft', () => {
    it('should delegate to service', async () => {
      const mockDraft = { firstName: 'John', amount: 100 };
      invoiceService.getInvoiceDraft.mockResolvedValue(mockDraft);

      const req = { user: { _id: 'user1', role: 'influencer' } } as any;
      const result = await controller.getDraft(req);

      expect(invoiceService.getInvoiceDraft).toHaveBeenCalledWith(req.user);
      expect(result).toEqual(mockDraft);
    });
  });

  describe('createInfluencerInvoice', () => {
    it('should throw UnauthorizedException if no user id', async () => {
      const req = { user: { _id: undefined, role: 'influencer' } } as any;
      const data = { firstName: 'Test' } as any;

      expect(() => controller.createInfluencerInvoice(req, data)).toThrow(UnauthorizedException);
    });
  });

  describe('getInvoices', () => {
    it('should delegate to service', async () => {
      const mockInvoices = [{ invoiceId: '1' }];
      invoiceService.getInvoices.mockResolvedValue(mockInvoices);

      const req = { user: { _id: 'user1', role: 'client' } } as any;
      const query = { limit: 10, page: 1 } as any;
      const result = await controller.getInvoices(req, query);

      expect(invoiceService.getInvoices).toHaveBeenCalledWith(query, req.user);
      expect(result).toEqual({ invoices: mockInvoices });
    });
  });
});
