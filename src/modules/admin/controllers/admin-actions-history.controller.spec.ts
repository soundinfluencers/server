import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

import { AdminActionsHistoryController } from './admin-actions-history.controller';
import { AdminActionsHistoryService } from '../services/admin-actions-history.service';
import { PaginationQueryDto } from '../../../common/dto/requests/pagination-query.dto';

describe('AdminActionsHistoryController', () => {
    let controller: AdminActionsHistoryController;
    let adminActionsHistoryService: {
        getInfluencerHistory: jest.Mock;
        checkIfAccountStillInCampaign: jest.Mock;
    };

    beforeEach(async () => {
        adminActionsHistoryService = {
            getInfluencerHistory: jest.fn(),
            checkIfAccountStillInCampaign: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AdminActionsHistoryController],
            providers: [{ provide: AdminActionsHistoryService, useValue: adminActionsHistoryService }],
        }).compile();

        controller = module.get<AdminActionsHistoryController>(AdminActionsHistoryController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('getInfluencerHistory delegates', async () => {
        const influencerId = new Types.ObjectId().toString();
        const query = { page: 1, limit: 10 } as PaginationQueryDto;
        const payload = {
            history: {} as any,
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 0,
        };
        adminActionsHistoryService.getInfluencerHistory.mockResolvedValueOnce(payload);

        const result = await controller.getInfluencerHistory(influencerId, query);

        expect(adminActionsHistoryService.getInfluencerHistory).toHaveBeenCalledWith(influencerId, query);
        expect(result).toBe(payload);
    });

    it('checkIfAccountStillInCampaign throws if no influencerId', () => {
        const actionId = new Types.ObjectId().toString();

        expect(() => controller.checkIfAccountStillInCampaign('', actionId)).toThrow(BadRequestException);
        expect(adminActionsHistoryService.checkIfAccountStillInCampaign).not.toHaveBeenCalled();
    });
});
