import { Test, TestingModule } from '@nestjs/testing';

import { AdminInfluencersController } from './admin-influencers.controller';
import { AdminInfluencersService } from '../services/admin-influencers.service';
import { SocialMediaEnum } from '../../../common/types/social-media.types';
import { AdminInfluencersQueryDto } from '../dto/influencers/admin-influencers-query.dto';

describe('AdminInfluencersController', () => {
    let controller: AdminInfluencersController;
    let adminInfluencersService: {
        getPaginated: jest.Mock;
        importXlsxSocialAccounts: jest.Mock;
    };

    beforeEach(async () => {
        adminInfluencersService = {
            getPaginated: jest.fn(),
            importXlsxSocialAccounts: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AdminInfluencersController],
            providers: [{ provide: AdminInfluencersService, useValue: adminInfluencersService }],
        }).compile();

        controller = module.get<AdminInfluencersController>(AdminInfluencersController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('getPaginated delegates to service', async () => {
        const query = { page: 1, limit: 10, platform: SocialMediaEnum.instagram } as AdminInfluencersQueryDto;
        const emptyList = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
        adminInfluencersService.getPaginated.mockResolvedValueOnce(emptyList);

        const result = await controller.getPaginated(query);

        expect(adminInfluencersService.getPaginated).toHaveBeenCalledWith(query);
        expect(result).toBe(emptyList);
    });

    it('getPaginated forwards search query to service', async () => {
        const query = { page: 1, limit: 5, search: 'user' } as AdminInfluencersQueryDto;
        const searchResult = { items: [], total: 0, page: 1, limit: 5, totalPages: 0 };
        adminInfluencersService.getPaginated.mockResolvedValueOnce(searchResult);

        const result = await controller.getPaginated(query);

        expect(adminInfluencersService.getPaginated).toHaveBeenCalledWith(query);
        expect(result).toBe(searchResult);
    });
});
