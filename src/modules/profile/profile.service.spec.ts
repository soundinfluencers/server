import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { ProfileService } from './profile.service';
import { AppGateway } from '../websocket/app.gateway';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../../integrations/email/email.service';
import { ExchangeRateService } from '../../integrations/exchange-rate/exchange-rate.service';
import { ClientRepository } from '../../database/repositories/users/client.repository';
import { InfluencerRepository } from '../../database/repositories/users/influencer.repository';
import { InvoiceDetailsRepository } from '../../database/repositories/invoices/invoice-details.repository';
import { UkBankTransferDetailsRepository } from '../../database/repositories/invoices/uk-transfer-details.repository';
import { InternationalBankTransferDetailsRepository } from '../../database/repositories/invoices/international-transfer-details.repository';
import { PaypalDetailsRepository } from '../../database/repositories/invoices/paypal-details.repository';
import { NegotiationRepository } from '../../database/repositories/negotiation/negotiation.repository';
import { Role } from '../../common/types/user.types';
import * as clientMapper from '../../common/mappers/client.mapper';
import * as influencerMapper from '../../common/mappers/influencer.mapper';

describe('ProfileService', () => {
  let service: ProfileService;
  let clientRepo: { findById: jest.Mock; findOne: jest.Mock; findOneAndUpdate: jest.Mock };
  let influencerRepo: { findById: jest.Mock; findOne: jest.Mock; findOneAndUpdate: jest.Mock };
  let mapClientSpy: jest.SpiedFunction<typeof clientMapper.mapClientToAccountDetailsDto>;
  let mapInfluencerSpy: jest.SpiedFunction<
    typeof influencerMapper.mapInfluencerToAccountDetailsDto
  >;

  beforeAll(() => {
    mapClientSpy = jest.spyOn(clientMapper, 'mapClientToAccountDetailsDto');
    mapInfluencerSpy = jest.spyOn(influencerMapper, 'mapInfluencerToAccountDetailsDto');
  });

  afterAll(() => {
    mapClientSpy.mockRestore();
    mapInfluencerSpy.mockRestore();
  });

  beforeEach(async () => {
    mapClientSpy.mockReturnValue({
      firstName: 'Jane',
      logoUrl: null,
      companyName: 'Co',
      email: 'j@example.com',
      phone: '1',
      isProposal: false,
    });
    mapInfluencerSpy.mockReturnValue({
      firstName: 'John',
      lastName: null,
      logoUrl: null,
      email: 'i@example.com',
      phone: '2',
      notificationMethods: { whatsapp: true, telegram: true },
      instagram: [],
      tiktok: [],
      spotify: [],
      youtube: [],
      facebook: [],
      soundcloud: [],
      press: [],
    });

    clientRepo = {
      findById: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    influencerRepo = {
      findById: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: AppGateway, useValue: {} },
        { provide: AuthService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: ExchangeRateService, useValue: {} },
        { provide: ClientRepository, useValue: clientRepo },
        { provide: InfluencerRepository, useValue: influencerRepo },
        { provide: InvoiceDetailsRepository, useValue: {} },
        { provide: UkBankTransferDetailsRepository, useValue: {} },
        { provide: InternationalBankTransferDetailsRepository, useValue: {} },
        { provide: PaypalDetailsRepository, useValue: {} },
        { provide: NegotiationRepository, useValue: {} },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getClientAccountDetails', () => {
    it('calls clientRepo and maps result', async () => {
      const clientDoc = {
        _id: new Types.ObjectId(),
        firstName: 'Jane',
        logoUrl: null,
        company: 'Co',
        email: 'j@example.com',
        phone: '1',
        isProposalClient: false,
      };
      clientRepo.findById.mockResolvedValue(clientDoc);

      const result = await service.getClientAccountDetails(clientDoc._id.toString());

      expect(clientRepo.findById).toHaveBeenCalledWith(clientDoc._id.toString());
      expect(mapClientSpy).toHaveBeenCalledWith(clientDoc);
      expect(result.firstName).toBe('Jane');
    });
  });

  describe('getInfluencerAccountDetails', () => {
    it('calls influencerRepo', async () => {
      const infDoc = { _id: new Types.ObjectId(), firstName: 'John' };
      influencerRepo.findById.mockResolvedValue(infDoc);

      await service.getInfluencerAccountDetails(infDoc._id.toString());

      expect(influencerRepo.findById).toHaveBeenCalledWith(infDoc._id.toString());
      expect(mapInfluencerSpy).toHaveBeenCalledWith(infDoc);
    });
  });

  describe('updateUserPassword', () => {
    it('throws UnauthorizedException if user not found', async () => {
      clientRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateUserPassword({
          _id: new Types.ObjectId().toString(),
          role: Role.client,
          currentPassword: 'old',
          newPassword: 'new',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(clientRepo.findOne).toHaveBeenCalled();
    });

    it('throws BadRequestException if wrong current password', async () => {
      const correct = 'correct-password';
      clientRepo.findOne.mockResolvedValue({
        password: bcrypt.hashSync(correct, 8),
      });

      await expect(
        service.updateUserPassword({
          _id: new Types.ObjectId().toString(),
          role: Role.client,
          currentPassword: 'wrong-password',
          newPassword: 'new-password',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(clientRepo.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });
});
