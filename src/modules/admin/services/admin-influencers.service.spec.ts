import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { Types } from 'mongoose';

import { AdminInfluencersService } from './admin-influencers.service';
import { InfluencerRepository } from '../../../database/repositories/users/influencer.repository';
import { XlsxImporter } from '../../../common/utils/import/xlsx/xlsx-import';
import { UpdateInfluencerService } from '../../profile/services/update-influencer.service';
import { CreateSocialAccountService } from '../../profile/services/create-social-account.service';
import { UpdateSocialAccountService } from '../../profile/services/update-social-account.service';
import { SocialMediaEnum } from '../../../common/types/social-media.types';
import { PaginationQueryDto } from '../../../common/dto/requests/pagination-query.dto';
import { CurrencyCode } from '../../../common/types/finance.types';

describe('AdminInfluencersService', () => {
    let service: AdminInfluencersService;
    let influencerRepo: {
        findInfluencers: jest.Mock;
        findMany: jest.Mock;
        bulkWrite: jest.Mock;
    };
    let xlsxImporter: { importInfluencers: jest.Mock };

    const baseListItem = {
        influencerId: new Types.ObjectId(),
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        phone: '',
        balance: 0,
        accountId: new Types.ObjectId(),
        username: 'user',
        socialMedia: SocialMediaEnum.instagram,
        logoUrl: '',
        followers: 100,
        profileLink: '',
        publicPrice: 10,
        price: 10,
        initialPrice: 10,
        currency: CurrencyCode.EUR,
        costPerFollower: 0.1,
        isHidden: false,
    };

    beforeEach(async () => {
        influencerRepo = {
            findInfluencers: jest.fn().mockResolvedValue({
                items: [],
                total: 0,
                page: 1,
                limit: 10,
                totalPages: 0,
            }),
            findMany: jest.fn(),
            bulkWrite: jest.fn(),
        };
        xlsxImporter = { importInfluencers: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdminInfluencersService,
                { provide: InfluencerRepository, useValue: influencerRepo },
                { provide: XlsxImporter, useValue: xlsxImporter },
                { provide: UpdateInfluencerService, useValue: { exec: jest.fn() } },
                { provide: CreateSocialAccountService, useValue: { execute: jest.fn() } },
                { provide: UpdateSocialAccountService, useValue: {} },
            ],
        }).compile();

        service = module.get<AdminInfluencersService>(AdminInfluencersService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('getPaginated maps items from findInfluencers', async () => {
        const query = { page: 1, limit: 10, platform: SocialMediaEnum.instagram } as PaginationQueryDto & {
            platform: SocialMediaEnum;
        };
        influencerRepo.findInfluencers.mockResolvedValueOnce({
            items: [baseListItem],
            total: 1,
            page: 1,
            limit: 10,
            totalPages: 1,
        });

        const result = await service.getPaginated(query);

        expect(influencerRepo.findInfluencers).toHaveBeenCalledWith(query);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].influencerId).toBe(baseListItem.influencerId.toString());
        expect(result.items[0].accountId).toBe(baseListItem.accountId.toString());
    });

    it('getPaginated returns empty items for empty list', async () => {
        const query = { page: 1, limit: 10, platform: SocialMediaEnum.tiktok } as PaginationQueryDto & {
            platform: SocialMediaEnum;
        };
        influencerRepo.findInfluencers.mockResolvedValueOnce({
            items: [],
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 0,
        });

        const result = await service.getPaginated(query);

        expect(result.items).toEqual([]);
    });

    it('importXlsxSocialAccounts throws if no accounts parsed', async () => {
        const file = { buffer: Buffer.from('') } as Express.Multer.File;
        xlsxImporter.importInfluencers.mockResolvedValueOnce([]);

        await expect(service.importXlsxSocialAccounts(SocialMediaEnum.instagram, file)).rejects.toThrow(
            InternalServerErrorException,
        );
    });
});
