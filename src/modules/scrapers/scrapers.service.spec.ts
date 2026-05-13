import { Test, TestingModule } from '@nestjs/testing';
import { ScrapersService } from './scrapers.service';
import { CampaignRepository } from '../../database/repositories/campaigns/campaign.repository';
import { InfluencerRepository } from '../../database/repositories/users/influencer.repository';
import { AppGateway } from '../websocket/app.gateway';

describe('ScrapersService', () => {
  let service: ScrapersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScrapersService,
        { provide: CampaignRepository, useValue: {} },
        { provide: InfluencerRepository, useValue: {} },
        { provide: AppGateway, useValue: {} },
      ],
    }).compile();

    service = module.get<ScrapersService>(ScrapersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
