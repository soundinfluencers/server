import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { OffersService } from './offers.service';
import { Offer } from '../../database/schemas/offer/offer.schema';
import { Influencer } from '../../database/schemas/users/influencer.schema';
import { ExchangeRateService } from '../../integrations/exchange-rate/exchange-rate.service';
import { OfferAccountLinkRepository } from '../../database/repositories/offers/offer-account-link.repository';

describe('OffersService', () => {
  let service: OffersService;
  let offersModel: Record<string, jest.Mock>;

  beforeEach(async () => {
    offersModel = {
      create: jest.fn(),
      find: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
      deleteOne: jest.fn(),
      findOneAndReplace: jest.fn(),
      aggregate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersService,
        { provide: getModelToken(Offer.name), useValue: offersModel },
        { provide: getModelToken(Influencer.name), useValue: {} },
        {
          provide: ExchangeRateService,
          useValue: { getAllRates: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: OfferAccountLinkRepository,
          useValue: {
            insertLinks: jest.fn(),
            findByOfferIds: jest.fn().mockResolvedValue([]),
            deleteByOfferId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OffersService>(OffersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOffer', () => {
    it('should create and return offer with code 201', async () => {
      const mockOffer = { _id: 'offer1', title: 'Test Offer' };
      offersModel.create.mockResolvedValue(mockOffer);

      const result = await service.createOffer({ title: 'Test Offer' } as any);

      expect(offersModel.create).toHaveBeenCalled();
      expect(result.code).toBe(201);
      expect(result.data).toEqual(mockOffer);
    });
  });
});
