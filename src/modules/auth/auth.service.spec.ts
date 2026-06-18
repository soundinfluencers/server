import { Test, TestingModule } from '@nestjs/testing';

import { AuthService } from './auth.service';
import { ClientRepository } from '../../database/repositories/users/client.repository';
import { InfluencerRepository } from '../../database/repositories/users/influencer.repository';
import { AdminRepository } from '../../database/repositories/users/admin.repository';
import { VerifyClientRepository } from '../../database/repositories/verify-users/verify-client.repository';
import { VerifyInfluencerRepository } from '../../database/repositories/verify-users/verify-influencer.repository';
import { ExchangeRateService } from '../../integrations/exchange-rate/exchange-rate.service';
import { EmailService } from '../../integrations/email/email.service';
import { AuthSessionRepository } from '../../database/repositories/auth/auth-session.repository';
import { CREATE_ADMIN_REQUEST_SERVICE } from '../admin/services/requests/create-admin-request.service';
import { LoginDto } from './dto/login.dto';
import { AccountVerifiedStatus, Role } from '../../common/types/user.types';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hashSync: jest.fn().mockReturnValue('hashedPassword'),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn(),
}));

jest.mock('../../common/utils/cookie.util', () => ({
  setRefreshTokenCookie: jest.fn(),
  clearRefreshTokenCookie: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  // mock client repository
  const clientRepo = {
    findClientByEmail: jest.fn(),
    findClientByInstagramUsername: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    updateOne: jest.fn(),
    startSession: jest.fn(),
    create: jest.fn(),
  };

  // mock influencer repository
  const influencerRepo = {
    findInfluencerByEmail: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    exists: jest.fn(),
    updateOne: jest.fn(),
    startSession: jest.fn(),
    create: jest.fn(),
  };

  // mock admin repository
  const adminRepo = {
    findAdminByEmail: jest.fn(),
    findById: jest.fn(),
    updateOne: jest.fn(),
  };

  // mock verifyClient repository
  const verifyClientRepo = {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
  };

  // mock verifyInfluence repository
  const verifyInfluencerRepo = {
    create: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
  };

  // mock authSession repository
  const authSessionRepo = {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    findOneAndDelete: jest.fn(),
  };

  // fake response
  const mockRes = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };

  const exchangeRateService = {
    getRate: jest.fn(),
  };

  const emailService = {
    send: jest.fn(),
  };

  const createAdminRequestService = {};

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    jest.clearAllMocks();

    // Creating test module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,

        { provide: ClientRepository, useValue: clientRepo },
        { provide: InfluencerRepository, useValue: influencerRepo },
        { provide: AdminRepository, useValue: adminRepo },

        { provide: VerifyClientRepository, useValue: verifyClientRepo },
        { provide: VerifyInfluencerRepository, useValue: verifyInfluencerRepo },
        { provide: AuthSessionRepository, useValue: authSessionRepo },

        { provide: ExchangeRateService, useValue: exchangeRateService },
        { provide: EmailService, useValue: emailService },

        {
          provide: CREATE_ADMIN_REQUEST_SERVICE,
          useValue: createAdminRequestService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Login behavior
  describe('login', () => {
    // helper for creating mock LoginDto
    function createLoginDto(overrides: Partial<LoginDto> = {}): LoginDto {
      return {
        email: 'test@gmail.com',
        password: 'test',
        role: Role.client,
        ...overrides,
      };
    }

    // helper for creating mock client
    function createUser(overrides: Partial<any> = {}) {
      return {
        _id: '12sasdf34ds56sd78',
        role: Role.client,
        firstName: 'name',
        balance: 0,
        company: 'Test company',
        companyType: 'Artist',
        instagramUsername: 'testInstagramUsername',
        email: 'test@gmail.com',
        phone: '+999999999999',
        password: 'hashed-password',
        isProposalClient: false,
        verifiedStatus: AccountVerifiedStatus.accept,
        ...overrides,
      };
    }

    it('should throw BadRequestException if role is unsupported', async () => {
      const dto = createLoginDto({
        role: 'guest' as Role,
      });

      await expect(service.login(dto, mockRes as unknown as Response)).rejects.toThrow(
        BadRequestException,
      );

      expect(clientRepo.findClientByEmail).not.toHaveBeenCalled();
      expect(influencerRepo.findInfluencerByEmail).not.toHaveBeenCalled();
      expect(adminRepo.findAdminByEmail).not.toHaveBeenCalled();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException client not found', async () => {
      // Arrange
      clientRepo.findClientByEmail.mockResolvedValue(null);

      // Act + Assert
      await expect(service.login(createLoginDto(), mockRes as unknown as Response)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(clientRepo.findClientByEmail).toHaveBeenCalledWith('test@gmail.com');

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should normalize email before searching user', async () => {
      const dto = createLoginDto({
        email: '   TEST@GMAIL.COM    ',
        role: Role.client,
      });

      clientRepo.findClientByEmail.mockResolvedValue(null);

      await expect(service.login(dto, mockRes as unknown as Response)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(clientRepo.findClientByEmail).toBeCalledWith('test@gmail.com');
    });

    it('should login client successfully', async () => {
      // mock dto
      const dto = createLoginDto();

      // mock client
      const client = createUser();

      clientRepo.findClientByEmail.mockResolvedValue(client);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(dto, mockRes as unknown as Response);

      expect(clientRepo.findClientByEmail).toHaveBeenCalledWith('test@gmail.com');

      expect(influencerRepo.findInfluencerByEmail).not.toHaveBeenCalled();
      expect(adminRepo.findAdminByEmail).not.toHaveBeenCalled();

      expect(bcrypt.compare).toHaveBeenCalledWith('test', 'hashed-password');

      expect(result).toEqual({ accessToken: 'mock-token' });
    });

    it('should login influencer successfully', async () => {
      // mock dto
      const dto = createLoginDto({
        role: Role.influencer,
      });

      // mock influencer
      const influencer = createUser({ role: Role.influencer });

      // setting mocks behavior
      influencerRepo.findInfluencerByEmail.mockResolvedValue(influencer);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(dto, mockRes as unknown as Response);

      expect(influencerRepo.findInfluencerByEmail).toHaveBeenCalledWith('test@gmail.com');

      // these two methods should not be called cause we are waiting for influencer
      expect(clientRepo.findClientByEmail).not.toHaveBeenCalled();
      expect(adminRepo.findAdminByEmail).not.toHaveBeenCalled();

      // expecting bcrypt.compare to be called with params in this order:
      // 1) plain-password from dto
      // 2) password hash from database
      expect(bcrypt.compare).toHaveBeenCalledWith('test', 'hashed-password');

      // Expecting result object to be equal to {accessToken: 'mock-token'}
      expect(result).toEqual({ accessToken: 'mock-token' });
    });

    it('should login admin successfully', async () => {
      const dto = createLoginDto({ role: Role.admin });
      const admin = createUser({ role: Role.admin });
      adminRepo.findAdminByEmail.mockResolvedValue(admin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const res = await service.login(dto, mockRes as unknown as Response);
      expect(adminRepo.findAdminByEmail).toHaveBeenCalledWith('test@gmail.com');
      expect(clientRepo.findClientByEmail).not.toHaveBeenCalled();
      expect(influencerRepo.findInfluencerByEmail).not.toHaveBeenCalled();
      expect(bcrypt.compare).toHaveBeenCalledWith('test', 'hashed-password');
      expect(res).toEqual({ accessToken: 'mock-token' });
    });
  });
});
