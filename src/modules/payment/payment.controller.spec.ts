import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentService: Record<string, jest.Mock>;

  beforeEach(async () => {
    paymentService = {
      createOrderStripe: jest.fn(),
      createOrderTransfer: jest.fn(),
      acceptOrderStripe: jest.fn(),
      cancelOrderStripe: jest.fn(),
      downloadPaymentInvoice: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        { provide: PaymentService, useValue: paymentService },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createOrderStripe', () => {
    it('should delegate to service', async () => {
      const data = { amount: 100 } as any;
      const expected = { orderId: 'order1' };
      paymentService.createOrderStripe.mockResolvedValue(expected);

      const result = await controller.createOrderStripe(data);

      expect(paymentService.createOrderStripe).toHaveBeenCalledWith(data);
      expect(result).toEqual(expected);
    });
  });

  describe('createOrderTransfer', () => {
    it('should delegate to service', async () => {
      const data = { amount: 200 } as any;
      const expected = { orderId: 'order2' };
      paymentService.createOrderTransfer.mockResolvedValue(expected);

      const result = await controller.createOrderTransfer(data);

      expect(paymentService.createOrderTransfer).toHaveBeenCalledWith(data);
      expect(result).toEqual(expected);
    });
  });
});
