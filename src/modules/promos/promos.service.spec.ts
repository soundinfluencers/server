import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { PromosService } from './promos.service';
import { ClientRepository } from '../../database/repositories/users/client.repository';
import { InfluencerRepository } from '../../database/repositories/users/influencer.repository';
import { CampaignRepository } from '../../database/repositories/campaigns/campaign.repository';
import { CompletedCampaignRepository } from '../../database/repositories/campaigns/completed-campaign.repository';
import { SocialMediaValidationStrategyFactory } from './strategies/social-media-validation.factory';
import { InfluencerActionsHistoryService } from '../influencer-actions-history/influencer-actions-history.service';
import {
  InfluencerDashboardPromoStatusRequest,
  InfluencerDetailedPromoStatusRequest,
} from '../../common/types/influencer/promo.types';

describe('PromosService', () => {
  let service: PromosService;
  let campaignRepo: {
    findOneCampaignAccountForInfluencer: jest.Mock;
    aggregate: jest.Mock;
  };
  let influencerRepo: { exists: jest.Mock };

  beforeEach(async () => {
    campaignRepo = {
      findOneCampaignAccountForInfluencer: jest.fn(),
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    };
    influencerRepo = {
      exists: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromosService,
        { provide: ClientRepository, useValue: {} },
        { provide: InfluencerRepository, useValue: influencerRepo },
        { provide: CampaignRepository, useValue: campaignRepo },
        { provide: CompletedCampaignRepository, useValue: {} },
        { provide: SocialMediaValidationStrategyFactory, useValue: {} },
        { provide: InfluencerActionsHistoryService, useValue: {} },
      ],
    }).compile();

    service = module.get<PromosService>(PromosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDetailedPromoByType', () => {
    const baseData = {
      campaignId: '507f1f77bcf86cd799439011',
      addedAccountsId: '507f1f77bcf86cd799439012',
      influencerId: '507f1f77bcf86cd799439013',
    };

    it('should throw Error for unsupported promo status', async () => {
      await expect(
        service.getDetailedPromoByType({
          ...baseData,
          status: 'invalid-status' as InfluencerDetailedPromoStatusRequest,
        }),
      ).rejects.toThrow('Unsupported promo status');
    });

    it('should call getNewPromo for "new" status', async () => {
      const spy = jest
        .spyOn(service, 'getNewPromo')
        .mockResolvedValue({} as Awaited<ReturnType<PromosService['getNewPromo']>>);

      await service.getDetailedPromoByType({
        ...baseData,
        status: InfluencerDetailedPromoStatusRequest.new,
      });

      expect(spy).toHaveBeenCalledWith(
        baseData.influencerId,
        baseData.campaignId,
        baseData.addedAccountsId,
      );
    });

    it('should call getOngoingPromo for "ongoing" status', async () => {
      const spy = jest
        .spyOn(service, 'getOngoingPromo')
        .mockResolvedValue({} as Awaited<ReturnType<PromosService['getOngoingPromo']>>);

      await service.getDetailedPromoByType({
        ...baseData,
        status: InfluencerDetailedPromoStatusRequest.ongoing,
      });

      expect(spy).toHaveBeenCalledWith(
        baseData.influencerId,
        baseData.campaignId,
        baseData.addedAccountsId,
      );
    });
  });

  describe('getDashboardPromos', () => {
    it('should call campaignRepo methods', async () => {
      const exec = jest.fn().mockResolvedValue([]);
      campaignRepo.aggregate.mockReturnValue({ exec });

      await service.getDashboardPromos({
        influencerId: new Types.ObjectId().toString(),
        limit: 12,
        page: 1,
        status: InfluencerDashboardPromoStatusRequest.ongoing,
      });

      expect(influencerRepo.exists).toHaveBeenCalled();
      expect(campaignRepo.aggregate).toHaveBeenCalled();
      expect(exec).toHaveBeenCalled();
    });
  });
});
