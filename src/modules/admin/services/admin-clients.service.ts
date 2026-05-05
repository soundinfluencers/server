import {BadRequestException, Injectable, InternalServerErrorException, Logger} from '@nestjs/common';
import {ClientRepository} from "../../../database/repositories/users/client.repository";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {
    AdminClientForListDto,
    AdminClientsListResponseDto,
    AdminClientsSearchResponseDto, AdminDetailedClientDto
} from "../dto/clients/admin-clients.dto";
import {IAdminClientListItem} from "../../../common/types/client/client.types";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {mapReadModelToAdminClientForListDto, mapToAdminDetailedClientDto} from "../../../common/mappers/client.mapper";
import {AdminUpdateClientDto} from "../dto/clients/admin-update-client.dto";

@Injectable()
export class AdminClientsService {
    constructor(
        private readonly clientsRepository: ClientRepository,
    ) {
    }

    async getClientsList(data: PaginationQueryDto): Promise<AdminClientsListResponseDto> {
        const list = await this.clientsRepository.findPaginated(data);
        return {
            ...list,
            items: list.items.map((i: IAdminClientListItem): AdminClientForListDto => {
                return mapReadModelToAdminClientForListDto(i);
            })
        };
    }

    async searchClients(data: SearchQueryDto): Promise<AdminClientsSearchResponseDto> {
        const searchResult = await this.clientsRepository.findBySearch(data);
        return {
            ...searchResult,
            items: searchResult.items.map((i: IAdminClientListItem): AdminClientForListDto => {
                return mapReadModelToAdminClientForListDto(i);
            })
        }
    }

    async getClientDetails(clientId: string): Promise<AdminDetailedClientDto> {
        const clientDetails = await this.clientsRepository.getClientsDetailsForAdmin(clientId);
        return mapToAdminDetailedClientDto(clientDetails);
    }

    async updateClient(clientId: string, data: AdminUpdateClientDto): Promise<AdminDetailedClientDto> {
        const entry = Object.entries(data).find(([, value]) => value !== undefined);

        if (!entry) {
            throw new BadRequestException('No field provided');
        }
        if (Object.keys(data).length > 1) {
            throw new BadRequestException('You can only update one field');
        }

        const [field, value] = entry;

        if (!['isProposalClient', 'internalNote'].includes(field)) {
            throw new BadRequestException('Unknown field provided');
        }

        const updateRes = await this.clientsRepository.updateOneField(clientId, field, value);

        if (!updateRes) {
            throw new InternalServerErrorException('Something went wrong while updating client');
        }

        return this.getClientDetails(clientId);
    }

    async deleteClient(clientId: string): Promise<void> {
        await this.clientsRepository.deleteById(clientId);
    }
}
