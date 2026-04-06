import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { MediaStrategyFactory } from './media.factory';

describe('MediaService', () => {
  let service: MediaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: MediaStrategyFactory, useValue: {} },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
