import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { AdminActionsHistoryService } from './admin-actions-history.service';
import { InfluencerRepository } from '../../../database/repositories/users/influencer.repository';
import { InfluencerHistoryRepository } from '../../../database/repositories/histories/influencer-history.repository';
import { CampaignRepository } from '../../../database/repositories/campaigns/campaign.repository';
import { PaginationQueryDto } from '../../../common/dto/requests/pagination-query.dto';
import { SocialMediaEnum } from '../../../common/types/social-media.types';

describe('AdminActionsHistoryService', () => {
    let service: AdminActionsHistoryService;
    let influencerRepo: { findById: jest.Mock };
    let historyRepo: { findPaginated: jest.Mock; findCampaignAction: jest.Mock };
    let campaignRepo: { checkIfAccountStillInCampaign: jest.Mock };

    const influencerId = new Types.ObjectId().toString();
    const actionId = new Types.ObjectId().toString();
    const query = { page: 1, limit: 10 } as PaginationQueryDto;

    const influencerWithAccount = {
        _id: new Types.ObjectId(influencerId),
        firstName: 'Test',
        email: 'test@example.com',
        currencyNote: null,
        [SocialMediaEnum.instagram]: [
            {
                _id: new Types.ObjectId(),
                username: 'u',
                price: 1,
            },
        ],
    };

    beforeEach(async () => {
        influencerRepo = { findById: jest.fn() };
        historyRepo = {
            findPaginated: jest.fn(),
            findCampaignAction: jest.fn(),
        };
        campaignRepo = { checkIfAccountStillInCampaign: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdminActionsHistoryService,
                { provide: InfluencerRepository, useValue: influencerRepo },
                { provide: InfluencerHistoryRepository, useValue: historyRepo },
                { provide: CampaignRepository, useValue: campaignRepo },
            ],
        }).compile();

        service = module.get<AdminActionsHistoryService>(AdminActionsHistoryService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('getInfluencerHistory throws NotFoundException if influencer not found', async () => {
        influencerRepo.findById.mockResolvedValue(null);

        await expect(service.getInfluencerHistory(influencerId, query)).rejects.toThrow(NotFoundException);
        await expect(service.getInfluencerHistory(influencerId, query)).rejects.toThrow(
            `Influencer ${influencerId} not found`,
        );
    });

    it('getInfluencerHistory throws NotFoundException if no history', async () => {
        influencerRepo.findById.mockResolvedValue(influencerWithAccount);
        historyRepo.findPaginated.mockResolvedValue({
            history: null,
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 0,
        });

        await expect(service.getInfluencerHistory(influencerId, query)).rejects.toThrow(NotFoundException);
        await expect(service.getInfluencerHistory(influencerId, query)).rejects.toThrow(
            `History for influencer ${influencerId} was not found`,
        );
    });

    it('checkIfAccountStillInCampaign throws NotFoundException if no action found', async () => {
        historyRepo.findCampaignAction.mockResolvedValue(null);

        await expect(service.checkIfAccountStillInCampaign(influencerId, actionId)).rejects.toThrow(NotFoundException);
        await expect(service.checkIfAccountStillInCampaign(influencerId, actionId)).rejects.toThrow(
            'This action was not found',
        );
    });
});
