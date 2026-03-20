import {Injectable, Logger} from '@nestjs/common';
import {ClientRepository} from "../../../database/repositories/users/client.repository";
import {CampaignRepository} from "../../../database/repositories/campaigns/campaign.repository";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";

// Interface for admin campaigns service
interface IAdminCampaignsService {
    getCampaignsList(data: PaginationQueryDto): Promise<any>;
    searchCampaigns(data: SearchQueryDto): Promise<any>;
    // getDetailedCampaign(data: SearchQueryDto): Promise<any>;
}

@Injectable()
export class AdminCampaignsService implements IAdminCampaignsService {
    constructor(
        private readonly clientsRepository: ClientRepository,
        private readonly campaignsRepository: CampaignRepository,
    ) {
    }

    private readonly logger = new Logger('AdminCampaignsService');

    async getCampaignsList(data: PaginationQueryDto): Promise<any> {

    }

    async searchCampaigns(data: SearchQueryDto): Promise<any> {

    }
}
