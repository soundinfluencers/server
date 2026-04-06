import { Test, TestingModule } from '@nestjs/testing';

import { AdminInfluencersController } from './admin-influencers.controller';
import { AdminInfluencersService } from '../services/admin-influencers.service';
import { SocialMediaEnum } from '../../../common/types/social-media.types';
import { PaginationQueryDto } from '../../../common/dto/requests/pagination-query.dto';
import { SearchQueryDto } from '../../../common/dto/requests/search-query.dto';

describe('AdminInfluencersController', () => {
    let controller: AdminInfluencersController;
    let adminInfluencersService: {
        getInfluencersList: jest.Mock;
        searchSocialAccounts: jest.Mock;
        importXlsxSocialAccounts: jest.Mock;
    };

    beforeEach(async () => {
        adminInfluencersService = {
            getInfluencersList: jest.fn(),
            searchSocialAccounts: jest.fn(),
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

    it('getInfluencersList delegates to service', async () => {
        const query = { page: 1, limit: 10 } as PaginationQueryDto;
        const emptyList = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
        adminInfluencersService.getInfluencersList.mockResolvedValueOnce(emptyList);

        const result = await controller.getInfluencersList(SocialMediaEnum.instagram, query);

        expect(adminInfluencersService.getInfluencersList).toHaveBeenCalledWith(SocialMediaEnum.instagram, query);
        expect(result).toBe(emptyList);
    });

    it('searchSocialAccounts delegates to service', async () => {
        const query = { search: 'user', limit: 5 } as SearchQueryDto;
        const searchResult = { items: [], total: 0 };
        adminInfluencersService.searchSocialAccounts.mockResolvedValueOnce(searchResult);

        const result = await controller.searchSocialAccounts(query);

        expect(adminInfluencersService.searchSocialAccounts).toHaveBeenCalledWith(query);
        expect(result).toBe(searchResult);
    });
});
