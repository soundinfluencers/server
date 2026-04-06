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

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { ClientRepository } from '../../database/repositories/users/client.repository';
import { InfluencerRepository } from '../../database/repositories/users/influencer.repository';
import { AdminRepository } from '../../database/repositories/users/admin.repository';
import { VerifyClientRepository } from '../../database/repositories/verify-users/verify-client.repository';
import { VerifyInfluencerRepository } from '../../database/repositories/verify-users/verify-influencer.repository';
import { ExchangeRateService } from '../../integrations/exchange-rate/exchange-rate.service';
import { EmailService } from '../../integrations/email/email.service';
import { LoginDto } from './dto/login.dto';
import { AccountVerifiedStatus, Role } from '../../common/types/user.types';
import { clearRefreshTokenCookie } from '../../common/utils/cookie.util';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('AuthService', () => {
  let service: AuthService;

  const clientRepo = {
    findClientByEmail: jest.fn(),
    findClientByInstagramUsername: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    updateOne: jest.fn(),
    startSession: jest.fn(),
    create: jest.fn(),
  };

  const influencerRepo = {
    findInfluencerByEmail: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    exists: jest.fn(),
    updateOne: jest.fn(),
    startSession: jest.fn(),
    create: jest.fn(),
  };

  const adminRepo = {
    findAdminByEmail: jest.fn(),
    findById: jest.fn(),
    updateOne: jest.fn(),
  };

  const verifyClientRepo = {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
  };

  const verifyInfluencerRepo = {
    create: jest.fn(),
    findById: jest.fn(),
  };

  const exchangeRateService = {
    getRate: jest.fn(),
  };

  const emailService = {
    send: jest.fn(),
  };

  const mockRes = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    jest.clearAllMocks();
    (jwt.sign as jest.Mock).mockReturnValue('mock-token');
    (jwt.verify as jest.Mock).mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ClientRepository, useValue: clientRepo },
        { provide: InfluencerRepository, useValue: influencerRepo },
        { provide: AdminRepository, useValue: adminRepo },
        { provide: VerifyClientRepository, useValue: verifyClientRepo },
        { provide: VerifyInfluencerRepository, useValue: verifyInfluencerRepo },
        { provide: ExchangeRateService, useValue: exchangeRateService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    clientRepo.updateOne.mockResolvedValue(undefined);
    influencerRepo.updateOne.mockResolvedValue(undefined);
    adminRepo.updateOne.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const baseDto: LoginDto = {
      email: 'user@example.com',
      password: 'plain',
      role: Role.client,
    };

    it('should throw UnauthorizedException if user not found', async () => {
      clientRepo.findClientByEmail.mockResolvedValue(null);

      await expect(service.login(baseDto, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(baseDto, mockRes)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw UnauthorizedException if wrong password', async () => {
      clientRepo.findClientByEmail.mockResolvedValue({
        _id: 'u1',
        password: 'hashed',
        verifiedStatus: AccountVerifiedStatus.accept,
        role: Role.client,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(baseDto, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(baseDto, mockRes)).rejects.toThrow(
        'Wrong password',
      );
    });

    it('should throw ForbiddenException if account not verified', async () => {
      clientRepo.findClientByEmail.mockResolvedValue({
        _id: 'u1',
        password: 'hashed',
        verifiedStatus: AccountVerifiedStatus.waitForAdmin,
        role: Role.client,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(baseDto, mockRes)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.login(baseDto, mockRes)).rejects.toThrow(
        'Account not verified by admin',
      );
    });

    it('should return accessToken on success', async () => {
      clientRepo.findClientByEmail.mockResolvedValue({
        _id: 'u1',
        password: 'hashed',
        verifiedStatus: AccountVerifiedStatus.accept,
        role: Role.client,
        isProposalClient: false,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(baseDto, mockRes);

      expect(result).toEqual({ accessToken: 'mock-token' });
      expect(clientRepo.updateOne).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException if no refresh token', async () => {
      await expect(service.refresh(undefined as unknown as string, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refresh('', mockRes)).rejects.toThrow(
        'No refresh token provided',
      );
    });

    it('should throw UnauthorizedException if invalid refresh token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(
        service.refresh('bad-token', mockRes),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refresh('bad-token', mockRes),
      ).rejects.toThrow('Invalid refresh token');
      expect(clearRefreshTokenCookie).toHaveBeenCalledWith(mockRes);
    });
  });

  describe('logout', () => {
    it('should throw UnauthorizedException if no refreshToken', async () => {
      await expect(
        service.logout(undefined as unknown as string, Role.client, mockRes),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.logout('', Role.client, mockRes),
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should clear cookie on success for client', async () => {
      const token = 'rt-1';
      await service.logout(token, Role.client, mockRes);

      expect(clientRepo.updateOne).toHaveBeenCalledWith(
        { refreshToken: token },
        { $unset: { refreshToken: '' } },
      );
      expect(clearRefreshTokenCookie).toHaveBeenCalledWith(mockRes);
    });
  });

  describe('getMe', () => {
    const userId = '507f1f77bcf86cd799439011';

    it('should throw BadRequestException for unsupported role', async () => {
      await expect(
        service.getMe(userId, 'guest' as Role, mockRes),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.getMe(userId, 'guest' as Role, mockRes),
      ).rejects.toThrow('Unsupported role');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      clientRepo.findById.mockResolvedValue(null);

      await expect(
        service.getMe(userId, Role.client, mockRes),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return user data for client', async () => {
      clientRepo.findById.mockResolvedValue({
        firstName: 'Alex',
        role: Role.client,
        verifiedStatus: AccountVerifiedStatus.accept,
        balance: 100,
        logoUrl: 'https://example.com/l.png',
      });

      const result = await service.getMe(userId, Role.client, mockRes);

      expect(result).toEqual({
        firstName: 'Alex',
        role: Role.client,
        verifiedStatus: AccountVerifiedStatus.accept,
        balance: 100,
        logoUrl: 'https://example.com/l.png',
      });
    });
  });

  describe('verifyAdminInfluencer', () => {
    it('should throw BadRequestException if no arguments', async () => {
      await expect(
        service.verifyAdminInfluencer('', 'accept'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyAdminInfluencer('id', ''),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyAdminClient', () => {
    it('should throw BadRequestException if no arguments', async () => {
      await expect(
        service.verifyAdminClient('', 'accept'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyAdminClient('id', ''),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createClient', () => {
    it('should throw BadRequestException if no data', async () => {
      await expect(
        service.createClient(null as never),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createClient(null as never),
      ).rejects.toThrow('Not enough arguments');
    });

    it('should throw ConflictException if email exists', async () => {
      const data = {
        firstName: 'A',
        company: 'C',
        companyType: 't',
        instagramUsername: 'ig',
        email: 'dup@example.com',
        phone: '1',
        referalCode: 'r',
        password: 'p',
        internalNote: 'n',
      };

      influencerRepo.findInfluencerByEmail.mockResolvedValue({ _id: 'existing' });
      clientRepo.findClientByInstagramUsername.mockResolvedValue(null);
      influencerRepo.findOne.mockResolvedValue(null);

      await expect(service.createClient(data)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.createClient(data)).rejects.toThrow(
        'User with this email already exists',
      );
    });
  });
});
