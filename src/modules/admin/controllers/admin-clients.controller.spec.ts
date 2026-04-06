import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import { AdminClientsController } from './admin-clients.controller';
import { AdminClientsService } from '../services/admin-clients.service';
import { PaginationQueryDto } from '../../../common/dto/requests/pagination-query.dto';
import { AdminUpdateClientDto } from '../dto/clients/admin-update-client.dto';

describe('AdminClientsController', () => {
    let controller: AdminClientsController;
    let adminClientsService: {
        getClientsList: jest.Mock;
        searchClients: jest.Mock;
        getClientDetails: jest.Mock;
        updateClient: jest.Mock;
    };

    beforeEach(async () => {
        adminClientsService = {
            getClientsList: jest.fn(),
            searchClients: jest.fn(),
            getClientDetails: jest.fn(),
            updateClient: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AdminClientsController],
            providers: [{ provide: AdminClientsService, useValue: adminClientsService }],
        }).compile();

        controller = module.get<AdminClientsController>(AdminClientsController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('getClients calls service (getClientsList when no search)', async () => {
        const query = { page: 1, limit: 10 } as PaginationQueryDto;
        adminClientsService.getClientsList.mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 10, totalPages: 0 });

        await controller.getClients(query);

        expect(adminClientsService.getClientsList).toHaveBeenCalledWith(query);
        expect(adminClientsService.searchClients).not.toHaveBeenCalled();
    });

    it('getDetailedClient calls service', async () => {
        const clientId = new Types.ObjectId().toString();
        adminClientsService.getClientDetails.mockResolvedValueOnce({ clientId } as any);

        await controller.getDetailedClient(clientId);

        expect(adminClientsService.getClientDetails).toHaveBeenCalledWith(clientId);
    });

    it('updateClient calls service', async () => {
        const clientId = new Types.ObjectId().toString();
        const data = { isProposalClient: true } as AdminUpdateClientDto;
        adminClientsService.updateClient.mockResolvedValueOnce({ clientId } as any);

        await controller.updateClient(clientId, data);

        expect(adminClientsService.updateClient).toHaveBeenCalledWith(clientId, data);
    });
});
