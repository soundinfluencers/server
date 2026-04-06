import { Test, TestingModule } from '@nestjs/testing';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';

describe('OffersController', () => {
  let controller: OffersController;
  let offersService: Record<string, jest.Mock>;

  beforeEach(async () => {
    offersService = {
      getAllOffersByGenreAndSocialMedia: jest.fn(),
      deleteOfferPermanently: jest.fn(),
      createOffer: jest.fn(),
      getPublishedOffersByGenreAndSocialMedia: jest.fn(),
      importXlsxOffers: jest.fn(),
      changeOfferDeletedStatus: jest.fn(),
      publishAllOffers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OffersController],
      providers: [
        { provide: OffersService, useValue: offersService },
      ],
    }).compile();

    controller = module.get<OffersController>(OffersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllOffersByGenreAndSocialMedia', () => {
    it('should return error for invalid social media', () => {
      const result = controller.getAllOffersByGenreAndSocialMedia('invalidMedia', 'EDM');

      expect(result).toEqual({
        code: 404,
        message: expect.stringContaining('Invalid social media'),
        offers: null,
      });
    });
  });

  describe('deleteOfferPermanently', () => {
    it('should return error for no offerId', () => {
      const result = controller.deleteOfferPermanently('');

      expect(result).toEqual({
        code: 404,
        message: expect.stringContaining('Invalid offerId'),
      });
    });
  });
});
