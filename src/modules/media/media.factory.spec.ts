import { Test, TestingModule } from '@nestjs/testing';
import { MediaStrategyFactory } from './media.factory';
import { DropboxMediaStrategy } from './strategies/dropbox.strategy';
import { DirectMediaStrategy } from './strategies/direct.strategy';
import { MediaProviderEnum } from '../../common/types/file/file.types';

describe('MediaStrategyFactory', () => {
  let factory: MediaStrategyFactory;
  let dropboxStrategy: { canHandle: jest.Mock };
  let directStrategy: { canHandle: jest.Mock };

  beforeEach(async () => {
    dropboxStrategy = { canHandle: jest.fn() };
    directStrategy = { canHandle: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaStrategyFactory,
        { provide: DropboxMediaStrategy, useValue: dropboxStrategy },
        { provide: DirectMediaStrategy, useValue: directStrategy },
      ],
    }).compile();

    factory = module.get<MediaStrategyFactory>(MediaStrategyFactory);
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  describe('getStrategy', () => {
    it('should return dropbox strategy if canHandle returns true', () => {
      dropboxStrategy.canHandle.mockReturnValue(true);

      const result = factory.getStrategy('https://dropbox.com/file');

      expect(result).toBe(dropboxStrategy);
    });

    it('should return direct strategy if canHandle returns false', () => {
      dropboxStrategy.canHandle.mockReturnValue(false);

      const result = factory.getStrategy('https://example.com/file');

      expect(result).toBe(directStrategy);
    });
  });

  describe('getStrategyByProvider', () => {
    it('should return direct strategy for MediaProviderEnum.direct', () => {
      const result = factory.getStrategyByProvider(MediaProviderEnum.direct);

      expect(result).toBe(directStrategy);
    });

    it('should return dropbox strategy for MediaProviderEnum.dropbox', () => {
      const result = factory.getStrategyByProvider(MediaProviderEnum.dropbox);

      expect(result).toBe(dropboxStrategy);
    });
  });
});
