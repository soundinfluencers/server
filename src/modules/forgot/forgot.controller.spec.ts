import { Test, TestingModule } from '@nestjs/testing';
import { ForgotController } from './forgot.controller';
import { ForgotService } from './forgot.service';

describe('ForgotController', () => {
  let controller: ForgotController;
  let forgotService: Record<string, jest.Mock>;

  beforeEach(async () => {
    forgotService = {
      createResetPasswordRequest: jest.fn(),
      closeResetPasswordRequest: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ForgotController],
      providers: [
        { provide: ForgotService, useValue: forgotService },
      ],
    }).compile();

    controller = module.get<ForgotController>(ForgotController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createResetRequest', () => {
    it('should call forgotService.createResetPasswordRequest', async () => {
      const data = { email: 'test@test.com', role: 'client' } as any;
      forgotService.createResetPasswordRequest.mockResolvedValue(undefined);

      await controller.createResetRequest(data);

      expect(forgotService.createResetPasswordRequest).toHaveBeenCalledWith(data);
    });
  });

  describe('closeResetRequest', () => {
    it('should call forgotService.closeResetPasswordRequest', async () => {
      const data = { token: 'abc', newPassword: 'newpass' } as any;
      forgotService.closeResetPasswordRequest.mockResolvedValue(undefined);

      await controller.closeResetRequest(data);

      expect(forgotService.closeResetPasswordRequest).toHaveBeenCalledWith(data);
    });
  });
});
