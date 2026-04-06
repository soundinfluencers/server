import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CreateClientDto } from './dto/create-client.dto';
import { CreateInfluencerDto } from './dto/create-influencer.dto';
import { LoginDto } from './dto/login.dto';
import {
  AccountVerifiedStatus,
  AuthenticatedRequest,
  Role,
} from '../../common/types/user.types';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    createClient: jest.fn(),
    createInfluencer: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    verifyAdminInfluencer: jest.fn(),
    verifyAdminClient: jest.fn(),
    getMe: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createClient', () => {
    it('should call authService.createClient with data', async () => {
      const data = { email: 'a@b.com' } as CreateClientDto;
      mockAuthService.createClient.mockResolvedValue(undefined);

      await controller.createClient(data);

      expect(mockAuthService.createClient).toHaveBeenCalledWith(data);
    });
  });

  describe('createInfluencer', () => {
    it('should call authService.createInfluencer with data', async () => {
      const data = { email: 'inf@b.com' } as CreateInfluencerDto;
      mockAuthService.createInfluencer.mockResolvedValue(undefined);

      await controller.createInfluencer(data);

      expect(mockAuthService.createInfluencer).toHaveBeenCalledWith(data);
    });
  });

  describe('login', () => {
    it('should call authService.login and return result', async () => {
      const dto = {
        email: 'u@b.com',
        password: 'secret',
        role: Role.client,
      } as LoginDto;
      const res = { cookie: jest.fn() } as unknown as Response;
      const loginResult = { accessToken: 'access-token' };
      mockAuthService.login.mockResolvedValue(loginResult);

      const result = await controller.login(dto, res);

      expect(mockAuthService.login).toHaveBeenCalledWith(dto, res);
      expect(result).toEqual(loginResult);
    });
  });

  describe('logout', () => {
    it('should call authService.logout', async () => {
      const refreshToken = 'refresh-token-value';
      const req = {
        cookies: { refreshToken },
        user: { role: Role.client },
      } as unknown as Parameters<AuthController['logout']>[0];
      const res = { clearCookie: jest.fn() } as unknown as Response;
      mockAuthService.logout.mockResolvedValue(undefined);

      await controller.logout(req, res);

      expect(mockAuthService.logout).toHaveBeenCalledWith(
        refreshToken,
        Role.client,
        res,
      );
    });
  });

  describe('verifyAdminInfluencer', () => {
    it('should call authService.verifyAdminInfluencer', async () => {
      const args = { verifyId: 'vid', responseVerify: 'accept' };
      mockAuthService.verifyAdminInfluencer.mockResolvedValue(undefined);

      await controller.verifyAdminInfluencer(args);

      expect(mockAuthService.verifyAdminInfluencer).toHaveBeenCalledWith(
        args.verifyId,
        args.responseVerify,
      );
    });
  });

  describe('verifyAdminClient', () => {
    it('should call authService.verifyAdminClient', async () => {
      const args = { verifyId: 'cid', responseVerify: 'cancel' };
      mockAuthService.verifyAdminClient.mockResolvedValue(undefined);

      await controller.verifyAdminClient(args);

      expect(mockAuthService.verifyAdminClient).toHaveBeenCalledWith(
        args.verifyId,
        args.responseVerify,
      );
    });
  });

  describe('getClientProfileDetails', () => {
    it('should call authService.getMe', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const req = {
        user: { _id: userId, role: Role.client },
      } as AuthenticatedRequest;
      const res = { clearCookie: jest.fn() } as unknown as Response;
      const meResponse = {
        firstName: 'Jane',
        role: Role.client,
        verifiedStatus: AccountVerifiedStatus.accept,
        balance: 0,
      };
      mockAuthService.getMe.mockResolvedValue(meResponse as never);

      const result = await controller.getClientProfileDetails(req, res);

      expect(mockAuthService.getMe).toHaveBeenCalledWith(
        userId,
        Role.client,
        res,
      );
      expect(result).toEqual(meResponse);
    });
  });
});
