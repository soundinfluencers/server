import {Injectable, Logger} from '@nestjs/common';
import {ClientRepository} from "../../../database/repositories/users/client.repository";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {
    AdminClientResponseDto,
    AdminClientsListResponseDto,
    AdminClientsSearchResponseDto
} from "../dto/clients/admin-clients.dto";
import {AdminClientListItem} from "../../../common/types/client/client.types";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {mapReadModelToAdminClientResponseDto} from "../../../common/mappers/client.mapper";

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
            items: list.items.map((i: AdminClientListItem): AdminClientResponseDto => {
                return mapReadModelToAdminClientResponseDto(i);
            })
        };
    }

    async searchClients(data: SearchQueryDto): Promise<AdminClientsSearchResponseDto> {
        const searchResult = await this.clientsRepository.findBySearch(data);
        return {
            ...searchResult,
            items: searchResult.items.map((i: AdminClientListItem): AdminClientResponseDto => {
                return mapReadModelToAdminClientResponseDto(i);
            })
        }
    }
}
