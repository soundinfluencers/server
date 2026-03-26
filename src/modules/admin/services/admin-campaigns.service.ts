import {Injectable, Logger} from '@nestjs/common';
import {ClientRepository} from "../../../database/repositories/users/client.repository";
import {CampaignRepository} from "../../../database/repositories/campaigns/campaign.repository";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {
    AdminCampaignSearchResponseDto,
    AdminCampaignsListResponseDto, AdminCampaignsListStatusEnum,
    GetAdminCampaignsListQueryDto
} from "../dto/campaigns/admin-campaigns.dto";
import {mapToAdminCampaignForListDto} from "../../../common/mappers/campaign.mapper";
import {IAdminCampaignForList} from "../../../common/types/client/campaign.types";
import {ProposalCampaignRepository} from "../../../database/repositories/campaigns/proposal-campaign.repository";

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
        private readonly proposalCampaignRepository: ProposalCampaignRepository,
    ) {
    }

    private readonly logger = new Logger('AdminCampaignsService');

    // Sort and merge ongoing and completed campaigns
    private mergeSortedCampaigns(
        ongoing: IAdminCampaignForList[],
        completed: IAdminCampaignForList[],
        proposal: IAdminCampaignForList[],
    ): IAdminCampaignForList[] {
        const sources = [ongoing, completed, proposal];
        const indexes = [0, 0, 0];
        const result: IAdminCampaignForList[] = [];

        while (true) {
            let bestSourceIndex = -1;
            let bestItem: IAdminCampaignForList | null = null;

            for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
                const itemIndex = indexes[sourceIndex];
                const candidate = sources[sourceIndex][itemIndex];

                if (!candidate) {
                    continue;
                }

                if (!bestItem) {
                    bestItem = candidate;
                    bestSourceIndex = sourceIndex;
                    continue;
                }

                const candidateTime = new Date(candidate.createdAt).getTime();
                const bestTime = new Date(bestItem.createdAt).getTime();

                if (candidateTime > bestTime) {
                    bestItem = candidate;
                    bestSourceIndex = sourceIndex;
                    continue;
                }

                if (candidateTime < bestTime) {
                    continue;
                }

                const candidateId = String(candidate._id);
                const bestId = String(bestItem._id);

                if (candidateId > bestId) {
                    bestItem = candidate;
                    bestSourceIndex = sourceIndex;
                }
            }

            if (bestSourceIndex === -1 || !bestItem) {
                break;
            }

            result.push(bestItem);
            indexes[bestSourceIndex]++;
        }

        return result;
    }

    async getCampaignsList(data: GetAdminCampaignsListQueryDto): Promise<AdminCampaignsListResponseDto> {
        // TODO: if admin created campaign - that will be input for link, if client created - that will be invoiceId

        const page = data.page ?? 1;
        const limit = data.limit ?? 10;
        const skip = (page - 1) * limit;
        const take = skip + limit;

        let ongoingResult = { items: [], total: 0 };
        let completedResult = { items: [], total: 0 };
        let proposalResult = { items: [], total: 0 };

        if (!data.status) {
            [ongoingResult, completedResult, proposalResult] = await Promise.all([
                this.campaignsRepository.getOngoingCampaignsForAdmin(data, take),
                this.campaignsRepository.getCompletedCampaignsForAdmin(data, take),
                this.proposalCampaignRepository.getProposalCampaignsForAdmin(data, take),
            ]);
        } else if (data.status === AdminCampaignsListStatusEnum.proposal) {
            proposalResult = await this.proposalCampaignRepository.getProposalCampaignsForAdmin(data, take);
        } else if (data.status === AdminCampaignsListStatusEnum.completed) {
            completedResult = await this.campaignsRepository.getCompletedCampaignsForAdmin(data, take);
        } else {
            ongoingResult = await this.campaignsRepository.getOngoingCampaignsForAdmin(data, take);
        }

        const merged = this.mergeSortedCampaigns(
            ongoingResult.items,
            completedResult.items,
            proposalResult.items,
        );

        const pagedItems = merged.slice(skip, skip + limit);
        const total = ongoingResult.total + completedResult.total + proposalResult.total;

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

        const [ongoingResult, completedResult, proposalResult] = await Promise.all([
            this.campaignsRepository.getOngoingCampaignsForAdmin(data, take),
            this.campaignsRepository.getCompletedCampaignsForAdmin(data, take),
            this.proposalCampaignRepository.getProposalCampaignsForAdmin(data, take),
        ]);

        const merged = this.mergeSortedCampaigns(
            ongoingResult.items,
            completedResult.items,
            proposalResult.items,
        );

        const items = merged.slice(0, limit);
        const total = ongoingResult.total + completedResult.total + proposalResult.total;

        return {
            total,
            limit,
            items: items.map(i => mapToAdminCampaignForListDto(i)),
        };
    }
}
