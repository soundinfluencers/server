import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ForgotService } from './forgot.service';
import { ForgotRepository } from './repositories/forgot.repository';
import { ClientRepository } from '../../database/repositories/users/client.repository';
import { InfluencerRepository } from '../../database/repositories/users/influencer.repository';
import { EmailService } from '../../integrations/email/email.service';
import { Role } from '../../common/types/user.types';

describe('ForgotService', () => {
  let service: ForgotService;
  let forgotRepo: Record<string, jest.Mock>;
  let clientRepo: Record<string, jest.Mock>;
  let influencerRepo: Record<string, jest.Mock>;
  let emailService: Record<string, jest.Mock>;

  beforeEach(async () => {
    forgotRepo = {
      exists: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      findOneAndDelete: jest.fn(),
      startSession: jest.fn(),
    };

    clientRepo = {
      findClientByEmail: jest.fn(),
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    influencerRepo = {
      findInfluencerByEmail: jest.fn(),
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    emailService = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForgotService,
        { provide: ForgotRepository, useValue: forgotRepo },
        { provide: ClientRepository, useValue: clientRepo },
        { provide: InfluencerRepository, useValue: influencerRepo },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<ForgotService>(ForgotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createResetPasswordRequest', () => {
    it('should throw BadRequestException for unsupported role', async () => {
      await expect(
        service.createResetPasswordRequest({ email: 'test@test.com', role: 'unknown' as Role }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user not found', async () => {
      clientRepo.findClientByEmail.mockResolvedValue(null);

      await expect(
        service.createResetPasswordRequest({ email: 'test@test.com', role: Role.client }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if request already exists', async () => {
      clientRepo.findClientByEmail.mockResolvedValue({ _id: 'user1', role: Role.client });
      forgotRepo.exists.mockResolvedValue(true);

      await expect(
        service.createResetPasswordRequest({ email: 'test@test.com', role: Role.client }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('closeResetPasswordRequest', () => {
    it('should throw NotFoundException if token invalid', async () => {
      forgotRepo.findOne.mockResolvedValue(null);

      await expect(
        service.closeResetPasswordRequest({ token: 'invalid-token', newPassword: 'newpass' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
