import {Injectable, Logger} from '@nestjs/common';
import {ClientRepository} from "../../../database/repositories/users/client.repository";
import {CampaignRepository} from "../../../database/repositories/campaigns/campaign.repository";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {
    AdminCampaignSearchResponseDto,
    AdminCampaignsListResponseDto,
    GetAdminCampaignsListQueryDto
} from "../dto/campaigns/admin-campaigns.dto";
import {mapToAdminCampaignForListDto} from "../../../common/mappers/campaign.mapper";
import {IAdminCampaignForList} from "../../../common/types/client/campaign.types";

// Interface for admin campaigns service and controller
export interface IAdminCampaignsService {
    getCampaignsList(data: GetAdminCampaignsListQueryDto): Promise<AdminCampaignsListResponseDto>;
    searchCampaigns(data: SearchQueryDto): Promise<AdminCampaignSearchResponseDto>;
    // todo: update admin meta campaign information
    // todo: getDetailedCampaign(data: SearchQueryDto): Promise<any>;
}

@Injectable()
export class AdminCampaignsService implements IAdminCampaignsService {
    constructor(
        private readonly clientsRepository: ClientRepository,
        private readonly campaignsRepository: CampaignRepository,
    ) {
    }

    private readonly logger = new Logger('AdminCampaignsService');

    // Sort and merge ongoing and completed campaigns
    private mergeSortedCampaigns(
        ongoing: IAdminCampaignForList[],
        completed: IAdminCampaignForList[],
    ): IAdminCampaignForList[] {
        const result: IAdminCampaignForList[] = [];

        let i = 0;
        let j = 0;

        while (i < ongoing.length && j < completed.length) {
            const left = ongoing[i];
            const right = completed[j];

            const leftTime = new Date(left.createdAt).getTime();
            const rightTime = new Date(right.createdAt).getTime();

            if (leftTime > rightTime) {
                result.push(left);
                i++;
                continue;
            }

            if (leftTime < rightTime) {
                result.push(right);
                j++;
                continue;
            }

            const leftId = String(left._id);
            const rightId = String(right._id);

            if (leftId > rightId) {
                result.push(left);
                i++;
            } else {
                result.push(right);
                j++;
            }
        }

        while (i < ongoing.length) {
            result.push(ongoing[i]);
            i++;
        }

        while (j < completed.length) {
            result.push(completed[j]);
            j++;
        }

        return result;
    }

    async getCampaignsList(data: GetAdminCampaignsListQueryDto): Promise<AdminCampaignsListResponseDto> {
        // TODO: if admin created campaign - that will be input for link, if client created - that will be invoiceId

        const page = data.page ?? 1;
        const limit = data.limit ?? 10;
        const skip = (page - 1) * limit;
        const take = skip + limit;

        const [ongoingResult, completedResult] = await Promise.all([
            this.campaignsRepository.getOngoingCampaignsForAdmin(data, take),
            this.campaignsRepository.getCompletedCampaignsForAdmin(data, take),
        ]);

        const merged = this.mergeSortedCampaigns(
            ongoingResult.items,
            completedResult.items,
        );

        const pagedItems = merged.slice(skip, skip + limit);
        const total = ongoingResult.total + completedResult.total;

        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            items: pagedItems.map(i => mapToAdminCampaignForListDto(i)),
        };
    }

    async searchCampaigns(data: SearchQueryDto): Promise<AdminCampaignSearchResponseDto> {
        const limit = data.limit ?? 10;
        const take = limit;

        const [ongoingResult, completedResult] = await Promise.all([
            this.campaignsRepository.getOngoingCampaignsForAdmin(data, take),
            this.campaignsRepository.getCompletedCampaignsForAdmin(data, take),
        ]);

        const merged = this.mergeSortedCampaigns(
            ongoingResult.items,
            completedResult.items,
        );

        const items = merged.slice(0, limit);
        const total = ongoingResult.total + completedResult.total;

        return {
            total,
            limit,
            items: items.map(i => mapToAdminCampaignForListDto(i)),
        };
    }
}
