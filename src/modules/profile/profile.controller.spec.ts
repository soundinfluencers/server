import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './services/profile.service';
import { AuthenticatedRequest, Role } from '../../common/types/user.types';

describe('ProfileController', () => {
  let controller: ProfileController;
  let profileService: {
    getClientAccountDetails: jest.Mock;
    getInfluencerAccountDetails: jest.Mock;
    getInvoiceDetails: jest.Mock;
    updateUserPassword: jest.Mock;
    getFilterOptions: jest.Mock;
  };

  beforeEach(async () => {
    profileService = {
      getClientAccountDetails: jest.fn().mockResolvedValue({}),
      getInfluencerAccountDetails: jest.fn().mockResolvedValue({}),
      getInvoiceDetails: jest.fn().mockResolvedValue({}),
      updateUserPassword: jest.fn().mockResolvedValue(undefined),
      getFilterOptions: jest.fn().mockResolvedValue({ filterArr: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [{ provide: ProfileService, useValue: profileService }],
    }).compile();

    controller = module.get<ProfileController>(ProfileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('controller routes delegate to service', () => {
    it('getClientProfileDetails delegates to getClientAccountDetails', async () => {
      const req = { user: { _id: 'client-1', role: Role.client } } as AuthenticatedRequest;

      await controller.getClientProfileDetails(req);

      expect(profileService.getClientAccountDetails).toHaveBeenCalledWith('client-1');
    });

    it('getInfluencerProfileDetails delegates to getInfluencerAccountDetails', async () => {
      const req = { user: { _id: 'inf-1', role: Role.influencer } } as AuthenticatedRequest;

      await controller.getInfluencerProfileDetails(req);

      expect(profileService.getInfluencerAccountDetails).toHaveBeenCalledWith('inf-1');
    });

    it('getInvoiceDetails delegates with user id and role', async () => {
      const req = {
        user: { _id: 'u1', role: Role.client },
      } as AuthenticatedRequest;

      await controller.getInvoiceDetails(req);

      expect(profileService.getInvoiceDetails).toHaveBeenCalledWith('u1', Role.client);
    });

    it('updatePasswordClient delegates to updateUserPassword with merged payload', async () => {
      const req = { user: { _id: 'u1', role: Role.influencer } } as AuthenticatedRequest;
      const body = { currentPassword: 'a', newPassword: 'b' } as any;

      await controller.updatePasswordClient(req, body);

      expect(profileService.updateUserPassword).toHaveBeenCalledWith({
        ...body,
        _id: 'u1',
        role: Role.influencer,
      });
    });

    it('getFilters delegates to getFilterOptions', async () => {
      const body = {} as any;

      await controller.getFilters(body);

      expect(profileService.getFilterOptions).toHaveBeenCalledWith(body);
    });

    it('throws UnauthorizedException when influencer profile requested without user id', () => {
      const req = { user: { role: Role.influencer } } as AuthenticatedRequest;

      expect(() => controller.getInfluencerProfileDetails(req)).toThrow(
        UnauthorizedException,
      );
      expect(profileService.getInfluencerAccountDetails).not.toHaveBeenCalled();
    });
  });
});
