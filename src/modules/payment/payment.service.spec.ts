import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PaymentService } from './payment.service';
import { Payment } from './schemas/payment.entity';
import { InvoiceDetails } from '../../database/schemas/invoices/invoice-details.schema';
import { Client } from '../../database/schemas/users/client.schema';

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getModelToken(Payment.name), useValue: {} },
        { provide: getModelToken(InvoiceDetails.name), useValue: {} },
        { provide: getModelToken(Client.name), useValue: {} },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
