import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PromosController } from './promos.controller';
import { PromosService } from './promos.service';
import { AuthenticatedRequest } from '../../common/types/user.types';
import { InfluencerDetailedPromoStatusRequest } from '../../common/types/influencer/promo.types';

describe('PromosController', () => {
  let controller: PromosController;
  let promosService: {
    getDashboardPromos: jest.Mock;
    getDetailedPromosByType: jest.Mock;
    updateResponseNewCampaign: jest.Mock;
    updateOngoingCampaign: jest.Mock;
  };

  beforeEach(async () => {
    promosService = {
      getDashboardPromos: jest.fn().mockResolvedValue([]),
      getDetailedPromosByType: jest.fn().mockResolvedValue([]),
      updateResponseNewCampaign: jest.fn().mockResolvedValue(undefined),
      updateOngoingCampaign: jest.fn().mockResolvedValue({ balance: 100 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromosController],
      providers: [{ provide: PromosService, useValue: promosService }],
    }).compile();

    controller = module.get<PromosController>(PromosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('influencerGetDashboardPromos', () => {
    it('should call promosService.getDashboardPromos', async () => {
      const query = { limit: 10, page: 1 } as any;
      const request = { user: { _id: 'user-1' } } as AuthenticatedRequest;

      await controller.influencerGetDashboardPromos(request, query);

      expect(promosService.getDashboardPromos).toHaveBeenCalledWith({
        ...query,
        influencerId: 'user-1',
      });
    });
  });

  describe('getDetailedPromo', () => {
    it('should throw ForbiddenException', async () => {
      const request = { user: { _id: 'user-1' } } as AuthenticatedRequest;
      const params = {
        status: InfluencerDetailedPromoStatusRequest.new,
        campaignId: 'c1',
        addedAccountsId: 'a1',
      } as any;

      await expect(controller.getDetailedPromo(request, params)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('influencerUpdateResponseToPromoRequest', () => {
    it('should throw UnauthorizedException if no user id', () => {
      const body = {} as any;
      const request = { user: {} } as AuthenticatedRequest;

      expect(() =>
        controller.influencerUpdateResponseToPromoRequest(body, request),
      ).toThrow(UnauthorizedException);
    });
  });

  describe('influencerUpdateOngoingCampaign', () => {
    it('should call promosService.updateOngoingCampaign', async () => {
      const body = {
        campaignId: 'c1',
        username: 'u1',
        addedAccountsId: 'a1',
        data: { postLink: 'https://example.com' },
      } as any;
      const request = { user: { _id: 'inf-1' } } as AuthenticatedRequest;

      await controller.influencerUpdateOngoingCampaign(request, body);

      expect(promosService.updateOngoingCampaign).toHaveBeenCalledWith({
        ...body,
        influencerId: 'inf-1',
      });
    });
  });
});
