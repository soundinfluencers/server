import {Injectable, Logger} from '@nestjs/common';
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

@Injectable()
export class AdminClientsService {
    constructor(
        private readonly clientsRepository: ClientRepository,
    ) {
    }

    private readonly logger = new Logger('AdminClientsService');

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

    async getClientsDetails(clientId: string): Promise<AdminDetailedClientDto> {
        const clientDetails = await this.clientsRepository.getClientsDetailsForAdmin(clientId);
        return mapToAdminDetailedClientDto(clientDetails);
    }
}
