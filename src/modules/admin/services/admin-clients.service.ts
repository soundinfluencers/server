import {Injectable, Logger} from '@nestjs/common';
import {ClientRepository} from "../../../database/repositories/users/client.repository";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {AdminClientResponseDto, AdminClientsListResponseDto} from "../dto/clients/admin-clients.dto";
import {AdminClientListItem} from "../../../common/types/client/client.types";

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
            items: list.items.map((i: AdminClientListItem): AdminClientResponseDto => ({
                company: i.company,
                firstName: i.firstName,
                lastName: i.lastName,
                email: i.email,
                phone: i.phone,
                companyType: i.companyType,
                id: i._id.toString(),
                proposalAccess: i.isProposal,
                campaignsCompleted: i.campaignsCompleted,
                campaignsActive: i.campaignsActive,
                ...(i.latestCampaign ? {
                    campaignName: i.latestCampaign.campaignName,
                    campaignId: i.latestCampaign._id.toString(),
                } : {}),
                ...(i.internalNote ? { internalNote: i.internalNote } : {}),
            }))
        };
    }
}
