import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { PromosService } from './promos.service';
import { ClientRepository } from '../../database/repositories/users/client.repository';
import { InfluencerRepository } from '../../database/repositories/users/influencer.repository';
import { CampaignRepository } from '../../database/repositories/campaigns/campaign.repository';
import { SocialMediaValidationStrategyFactory } from './strategies/social-media-validation.factory';
import { InfluencerActionsHistoryService } from '../influencer-actions-history/influencer-actions-history.service';
import {
  InfluencerConfirmationStatusEnum,
  InfluencerDashboardPromoStatusRequest,
  InfluencerDetailedPromoStatusRequest,
  InfluencerPromoClosedStatusEnum,
} from '../../common/types/influencer/promo.types';
import {
  InfluencerUpdatedPostDetailsDto,
  InfluencerUpdatePromoReqBodyDto,
} from './dto/influencer-get-promos.dto';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Campaign, CampaignAccount } from 'src/database/schemas/campaign/campaign.schema';
import { ObjId } from '../../common/types/base.types';
import { SocialMediaEnum } from '../../common/types/social-media.types';
import { CurrencyCode } from '../../common/types/finance.types';
import {
  CampaignConfirmationEnum,
  CampaignPaymentMethodEnum,
  CampaignPaymentStatusEnum,
  CampaignStatusEnum,
} from '../../common/types/client/campaign.types';
import { DefaultSocialValidationStrategy } from './strategies/default-validation.strategy';
import { SpotifyValidationStrategy } from './strategies/spotify-validation.strategy';
import { PressValidationStrategy } from './strategies/press-validation.strategy';
import { SoundcloudValidationStrategy } from './strategies/soundcloud-validation.strategy';
import { InvoiceStatusEnum } from '../../common/types/invoice.types';
import { CompletedCampaignRepository } from '../../database/repositories/campaigns/completed-campaign.repository';

describe('PromosService', () => {
  let service: PromosService;
  let campaignRepo: {
    findOneCampaignAccountForInfluencer: jest.Mock;
    findOne: jest.Mock;
    aggregate: jest.Mock;
    startSession: jest.Mock;
    updateOne: jest.Mock;
  };
  let completedCampaignRepo: Record<string, jest.Mock>;
  let influencerRepo: {
    exists: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };
  let influencerActionsHistoryService: {
    upsertInfluencerCampaignActionsHistory: jest.Mock;
  };
  let session: {
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    abortTransaction: jest.Mock;
    endSession: jest.Mock;
  };
  let validationStrategyFactory: {
    get: jest.Mock;
  };

  beforeEach(async () => {
    session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      abortTransaction: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    completedCampaignRepo = {};

    campaignRepo = {
      findOneCampaignAccountForInfluencer: jest.fn(),
      findOne: jest.fn(),
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
      startSession: jest.fn().mockResolvedValue(session),
      updateOne: jest.fn(),
    };

    influencerRepo = {
      exists: jest.fn().mockResolvedValue(true),
      findOneAndUpdate: jest.fn(),
    };

    validationStrategyFactory = {
      get: jest.fn(),
    };

    influencerActionsHistoryService = {
      upsertInfluencerCampaignActionsHistory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromosService,
        { provide: ClientRepository, useValue: {} },
        { provide: CompletedCampaignRepository, useValue: completedCampaignRepo },
        { provide: InfluencerRepository, useValue: influencerRepo },
        { provide: CampaignRepository, useValue: campaignRepo },
        { provide: SocialMediaValidationStrategyFactory, useValue: validationStrategyFactory },
        { provide: InfluencerActionsHistoryService, useValue: influencerActionsHistoryService },
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

  describe('updateOngoingCampaign', () => {
    function createDto(
      override: Partial<InfluencerUpdatePromoReqBodyDto> = {},
      overrideDto: Partial<InfluencerUpdatedPostDetailsDto> = {},
    ): InfluencerUpdatePromoReqBodyDto {
      const dto: InfluencerUpdatePromoReqBodyDto = {
        campaignId: '6825eb15d0d7f434ec4d1099',
        addedAccountsId: '9995eb15d0d7f434ec4d1099',
        influencerId: '9995eb15d0d7f434ec4d1100',
        username: 'testUsername',
        data: {
          postLink: 'https://instagram.com/p/ABC123',
          screenshotUrl: 'https://cdn.example.com/screenshots/post.png',
          impressions: 999,
          like: 999,
          comments: 999,
          shares: 999,
          saves: 999,
          datePost: '03.06.2026',
        },
      };

      return {
        ...dto,
        ...override,
        data: {
          ...dto.data,
          ...overrideDto,
        },
      };
    }

    function createInstagramCampaign(promoOverride: Partial<CampaignAccount> = {}): Campaign {
      return {
        _id: new ObjId('6825eb15d0d7f434ec4d1099'),
        schemaVersion: 2,
        clientId: new ObjId('6825eb15d0df3434ec4d1099'),
        socialMedia: SocialMediaEnum.instagram,
        campaignName: 'Test campaign',
        campaignPrice: 999,
        displayCurrency: CurrencyCode.EUR,
        addedAccounts: [
          {
            _id: new ObjId('9995eb15d0d7f434ec4d1099'),
            influencerId: new ObjId('9995eb15d0d7f434ec4d1100'),
            accountId: new ObjId('9995eb15d0d7f434fc4d1199'),
            socialMedia: SocialMediaEnum.instagram,
            username: 'test_username',
            price: 400,
            publicPrice: 999,
            followers: 9999,
            selectedContent: {
              campaignContentItemId: new ObjId('8795eb15d0d7f434ec4d1100'),
              descriptionId: new ObjId('8895eb15d0d7f434ec4d1100'),
            },
            confirmation: InfluencerConfirmationStatusEnum.accept,
            closePromo: InfluencerPromoClosedStatusEnum.wait,
            ...promoOverride,
          },
        ],
        campaignContent: [
          {
            _id: new ObjId('8795eb15d0d7f434ec4d1100'),
            socialMedia: SocialMediaEnum.instagram,
            socialMediaGroup: 'main',
            mainLink: 'https://test.main_link',
            descriptions: [
              {
                _id: new ObjId('8895eb15d0d7f434ec4d1100'),
                description: 'This is test description',
              },
            ],
          },
        ],
        verifyCampaign: CampaignConfirmationEnum.accept,
        statusCampaign: CampaignStatusEnum.distributing,
        paymentStatus: CampaignPaymentStatusEnum.confirmed,
        paymentType: CampaignPaymentMethodEnum.paypal,
        shareLink: 'https://test',
        isCpmAndResultHidden: false,
      };
    }

    it.each([
      ['campaignId', { campaignId: undefined }],
      ['influencerId', { influencerId: undefined }],
      ['addedAccountsId', { addedAccountsId: undefined }],
      ['username', { username: undefined }],
      ['data', { data: undefined }],
    ])('should throw BadRequestException if %s is missing', async (_, override) => {
      const dto = {
        ...createDto({}, {}),
        ...override,
      } as unknown as InfluencerUpdatePromoReqBodyDto;

      const promise = service.updateOngoingCampaign(dto);

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow('Not enough arguments');

      expect(campaignRepo.findOne).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException if campaign wasn't found", async () => {
      const dto = createDto();

      campaignRepo.findOne.mockResolvedValue(null);

      const promise = service.updateOngoingCampaign(dto);

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Campaign not found');

      expect(campaignRepo.findOne).toHaveBeenCalledWith(
        {
          _id: new Types.ObjectId(dto.campaignId),
          addedAccounts: {
            $elemMatch: {
              influencerId: new Types.ObjectId(dto.influencerId),
              _id: new Types.ObjectId(dto.addedAccountsId),
            },
          },
        },
        { lean: true },
      );

      expect(validationStrategyFactory.get).not.toHaveBeenCalled();
    });

    // default social media validation test
    it.each([
      ['postLink', { postLink: undefined }, 'Post link required'],
      ['screenshotUrl', { screenshotUrl: undefined }, 'Invalid promo data'],
      ['impressions', { impressions: undefined }, 'Invalid promo data'],
      ['like', { like: undefined }, 'Invalid promo data'],
    ])(
      'should throw BadRequestException if default social data.%s is missing',
      async (_, invalidPostDetails, expectedMessage) => {
        const dto = createDto({}, invalidPostDetails);
        const campaign = createInstagramCampaign();

        campaignRepo.findOne.mockResolvedValue(campaign);
        validationStrategyFactory.get.mockReturnValue(new DefaultSocialValidationStrategy());

        const promise = service.updateOngoingCampaign(dto);

        await expect(promise).rejects.toThrow(BadRequestException);
        await expect(promise).rejects.toThrow(expectedMessage);

        expect(validationStrategyFactory.get).toHaveBeenCalledWith(SocialMediaEnum.instagram);
      },
    );

    // spotify validation test
    it.each([
      ['rating', { rating: undefined }],
      ['screenshotUrl', { rating: 5, screenshotUrl: undefined }],
    ])(
      'should throw BadRequestException if spotify data.%s is missing',
      async (_, invalidPostDetails) => {
        const dto = createDto({}, invalidPostDetails);

        const campaign = createInstagramCampaign({
          socialMedia: SocialMediaEnum.spotify,
        });

        campaignRepo.findOne.mockResolvedValue(campaign);
        validationStrategyFactory.get.mockReturnValue(new SpotifyValidationStrategy());

        const promise = service.updateOngoingCampaign(dto);

        await expect(promise).rejects.toThrow(BadRequestException);

        expect(validationStrategyFactory.get).toHaveBeenCalledWith(SocialMediaEnum.spotify);
      },
    );

    // press validation test
    it('should throw BadRequestException if soundcloud data.screenshotUrl is missing', async () => {
      const dto = createDto({}, { screenshotUrl: undefined });

      const campaign = createInstagramCampaign({
        socialMedia: SocialMediaEnum.soundcloud,
      });

      campaignRepo.findOne.mockResolvedValue(campaign);
      validationStrategyFactory.get.mockReturnValue(new SoundcloudValidationStrategy());

      const promise = service.updateOngoingCampaign(dto);

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow('Screenshot required');

      expect(validationStrategyFactory.get).toHaveBeenCalledWith(SocialMediaEnum.soundcloud);
    });

    // press validation test
    it('should throw BadRequestException if press data.postLink is missing', async () => {
      const dto = createDto({}, { postLink: undefined });

      const campaign = createInstagramCampaign({
        socialMedia: SocialMediaEnum.press,
      });

      campaignRepo.findOne.mockResolvedValue(campaign);
      validationStrategyFactory.get.mockReturnValue(new PressValidationStrategy());

      const promise = service.updateOngoingCampaign(dto);

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow('Post link required');

      expect(validationStrategyFactory.get).toHaveBeenCalledWith(SocialMediaEnum.press);
    });

    it('should close promo, increment influencer balance, write history and commit transaction', async () => {
      const dto = createDto();
      const campaign = createInstagramCampaign();

      const strategy = {
        validate: jest.fn(),
      };

      campaignRepo.findOne.mockResolvedValue(campaign);
      validationStrategyFactory.get.mockReturnValue(strategy);
      campaignRepo.updateOne.mockResolvedValue({ modifiedCount: 1 });

      influencerRepo.findOneAndUpdate.mockResolvedValue({
        _id: new ObjId(dto.influencerId),
        balance: 1400,
      });

      influencerActionsHistoryService.upsertInfluencerCampaignActionsHistory.mockResolvedValue(
        undefined,
      );

      const result = await service.updateOngoingCampaign(dto);

      expect(result).toEqual({ balance: 1400 });

      expect(validationStrategyFactory.get).toHaveBeenCalledWith(SocialMediaEnum.instagram);

      expect(strategy.validate).toHaveBeenCalledWith(dto.data);

      expect(campaignRepo.startSession).toHaveBeenCalled();
      expect(session.startTransaction).toHaveBeenCalled();

      expect(campaignRepo.updateOne).toHaveBeenCalledWith(
        {
          _id: new Types.ObjectId(dto.campaignId),
          'addedAccounts._id': new Types.ObjectId(dto.addedAccountsId),
        },
        {
          $set: expect.objectContaining({
            'addedAccounts.$.postLink': dto.data.postLink,
            'addedAccounts.$.screenshotUrl': dto.data.screenshotUrl,
            'addedAccounts.$.screenshot': dto.data.screenshotUrl,
            'addedAccounts.$.impressions': dto.data.impressions,
            'addedAccounts.$.like': dto.data.like,
            'addedAccounts.$.closePromo': InfluencerPromoClosedStatusEnum.close,
            'addedAccounts.$.invoiceStatus': InvoiceStatusEnum.wait,
          }),
        },
        { session },
      );

      expect(influencerRepo.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new Types.ObjectId(dto.influencerId) },
        { $inc: { balance: 400 } },
        { session, new: true },
      );

      expect(
        influencerActionsHistoryService.upsertInfluencerCampaignActionsHistory,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          influencerId: dto.influencerId,
          campaignId: dto.campaignId,
          campaignName: campaign.campaignName,
          updatedCampaignAction: expect.objectContaining({
            addedAccountsId: new ObjId(dto.addedAccountsId),
            socialAccountId: campaign.addedAccounts[0]._id,
            actionNumber: 2,
            networkUsername: dto.username,
            rewardForInfluencer: 400,
            socialMedia: SocialMediaEnum.instagram,
          }),
        }),
        session,
      );

      expect(session.commitTransaction).toHaveBeenCalled();
      expect(session.abortTransaction).not.toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalled();
    });

    it('should abort transaction and throw ConflictException if promo was already closed', async () => {
      const dto = createDto();
      const campaign = createInstagramCampaign();

      const strategy = {
        validate: jest.fn(),
      };

      campaignRepo.findOne.mockResolvedValue(campaign);
      validationStrategyFactory.get.mockReturnValue(strategy);
      campaignRepo.updateOne.mockResolvedValue({ modifiedCount: 0 });

      const promise = service.updateOngoingCampaign(dto);

      await expect(promise).rejects.toThrow(ConflictException);
      await expect(promise).rejects.toThrow('Promo was closed by another request');

      expect(campaignRepo.updateOne).toHaveBeenCalled();

      expect(influencerRepo.findOneAndUpdate).not.toHaveBeenCalled();
      expect(
        influencerActionsHistoryService.upsertInfluencerCampaignActionsHistory,
      ).not.toHaveBeenCalled();

      expect(session.commitTransaction).not.toHaveBeenCalled();
      expect(session.abortTransaction).toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalled();
    });

    it('should abort transaction and throw InternalServerErrorException if reward is invalid', async () => {
      const dto = createDto();

      const campaign = createInstagramCampaign({
        price: undefined as unknown as number,
      });

      const strategy = {
        validate: jest.fn(),
      };

      campaignRepo.findOne.mockResolvedValue(campaign);
      validationStrategyFactory.get.mockReturnValue(strategy);
      campaignRepo.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const promise = service.updateOngoingCampaign(dto);

      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow('Invalid influencer reward in database');

      expect(campaignRepo.updateOne).toHaveBeenCalled();
      expect(influencerRepo.findOneAndUpdate).not.toHaveBeenCalled();

      expect(session.commitTransaction).not.toHaveBeenCalled();
      expect(session.abortTransaction).toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalled();
    });

    it("should abort transaction and throw InternalServerErrorException if influencer balance wasn't updated", async () => {
      const dto = createDto();
      const campaign = createInstagramCampaign();

      const strategy = {
        validate: jest.fn(),
      };

      campaignRepo.findOne.mockResolvedValue(campaign);
      validationStrategyFactory.get.mockReturnValue(strategy);
      campaignRepo.updateOne.mockResolvedValue({ modifiedCount: 1 });
      influencerRepo.findOneAndUpdate.mockResolvedValue(null);

      const promise = service.updateOngoingCampaign(dto);

      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow("Can't update influencer's balance");

      expect(campaignRepo.updateOne).toHaveBeenCalled();
      expect(influencerRepo.findOneAndUpdate).toHaveBeenCalled();

      expect(
        influencerActionsHistoryService.upsertInfluencerCampaignActionsHistory,
      ).not.toHaveBeenCalled();

      expect(session.commitTransaction).not.toHaveBeenCalled();
      expect(session.abortTransaction).toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalled();
    });

    it('should not start transaction if validation strategy throws', async () => {
      const dto = createDto();
      const campaign = createInstagramCampaign();

      const strategy = {
        validate: jest.fn(() => {
          throw new BadRequestException('Invalid promo data');
        }),
      };

      campaignRepo.findOne.mockResolvedValue(campaign);
      validationStrategyFactory.get.mockReturnValue(strategy);

      const promise = service.updateOngoingCampaign(dto);

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow('Invalid promo data');

      expect(strategy.validate).toHaveBeenCalledWith(dto.data);

      expect(campaignRepo.startSession).not.toHaveBeenCalled();
      expect(campaignRepo.updateOne).not.toHaveBeenCalled();
      expect(influencerRepo.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });
});
