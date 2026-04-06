import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

import { AdminClientsService } from './admin-clients.service';
import { ClientRepository } from '../../../database/repositories/users/client.repository';
import { PaginationQueryDto } from '../../../common/dto/requests/pagination-query.dto';

describe('AdminClientsService', () => {
    let service: AdminClientsService;
    let clientRepository: {
        findPaginated: jest.Mock;
        findBySearch: jest.Mock;
        getClientsDetailsForAdmin: jest.Mock;
        updateOneField: jest.Mock;
    };

    beforeEach(async () => {
        clientRepository = {
            findPaginated: jest.fn().mockResolvedValue({
                items: [],
                total: 0,
                page: 1,
                limit: 10,
                totalPages: 0,
            }),
            findBySearch: jest.fn(),
            getClientsDetailsForAdmin: jest.fn(),
            updateOneField: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [AdminClientsService, { provide: ClientRepository, useValue: clientRepository }],
        }).compile();

        service = module.get<AdminClientsService>(AdminClientsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('getClientsList calls repo', async () => {
        const data = { page: 2, limit: 5 } as PaginationQueryDto;

        await service.getClientsList(data);

        expect(clientRepository.findPaginated).toHaveBeenCalledWith(data);
    });

    it('updateClient throws BadRequestException if no field provided', async () => {
        const clientId = new Types.ObjectId().toString();

        await expect(service.updateClient(clientId, {})).rejects.toThrow(BadRequestException);
        await expect(service.updateClient(clientId, {})).rejects.toThrow('No field provided');
    });

    it('updateClient throws BadRequestException if more than one field', async () => {
        const clientId = new Types.ObjectId().toString();

        await expect(
            service.updateClient(clientId, {
                isProposalClient: true,
                internalNote: 'x',
            } as any),
        ).rejects.toThrow(BadRequestException);
        await expect(
            service.updateClient(clientId, {
                isProposalClient: true,
                internalNote: 'x',
            } as any),
        ).rejects.toThrow('You can only update one field');
    });

    it('updateClient throws BadRequestException if unknown field', async () => {
        const clientId = new Types.ObjectId().toString();

        await expect(service.updateClient(clientId, { unknownField: 'x' } as any)).rejects.toThrow(BadRequestException);
        await expect(service.updateClient(clientId, { unknownField: 'x' } as any)).rejects.toThrow('Unknown field provided');
    });
});
