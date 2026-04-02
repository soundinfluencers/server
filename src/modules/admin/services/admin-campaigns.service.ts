import {BadRequestException, Injectable, Logger, NotFoundException} from '@nestjs/common';
import {CampaignRepository} from "../../../database/repositories/campaigns/campaign.repository";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";
import {
    AdminCampaignDetailsDto,
    AdminCampaignSearchResponseDto,
    AdminCampaignsListResponseDto,
    AdminCampaignsListStatusEnum,
    GetAdminCampaignsListQueryDto
} from "../dto/campaigns/admin-campaigns.dto";
import {
    mapSchemaToIAdminCampaignDetails, mapToAdminCampaignDetailsDto,
    mapToAdminCampaignForListDto,
} from "../../../common/mappers/campaign.mapper";
import {
    CampaignAdminMetaEnum, IAdminCampaignDetails,
    IAdminCampaignForList
} from "../../../common/types/client/campaign.types";
import {ProposalCampaignRepository} from "../../../database/repositories/campaigns/proposal-campaign.repository";
import {UpdateAdminMetaCampaignDto, UpdatedAdminMetaCampaignDto} from "../dto/campaigns/admin-update-campaign.dto";
import {CompletedCampaignRepository} from "../../../database/repositories/campaigns/completed-campaign.repository";
import {Campaign, CampaignAccount} from "../../../database/schemas/campaign/campaign.schema";
import {CompletedCampaign} from "../../../database/schemas/campaign/completed-campaign.schema";
import {ProposalCampaign} from "../../../database/schemas/campaign/proposal-campaign.schema";
import {CampaignDetailsService} from "../../campaigns/services/campaign-details.service";
import {UpdateCampaignDto} from "../../campaigns/dto/update-campaign.dto";
import {CampaignUpdateService} from "../../campaigns/services/campaign-update.service";
import {HydratedDocument} from "mongoose";
import {CampaignAccountsBuilderService} from "../../campaigns/services/campaign-accounts-builder.service";
import {ObjId} from "../../../common/types/base.types";

// Interface for admin campaigns service and controller
export interface IAdminCampaignsService {
    getCampaignsList(data: GetAdminCampaignsListQueryDto): Promise<AdminCampaignsListResponseDto>;

    searchCampaigns(data: SearchQueryDto): Promise<AdminCampaignSearchResponseDto>;

    // Updates admin's meta fields in campaign
    updateMeta(
        payload: UpdateAdminMetaCampaignDto,
        status: AdminCampaignsListStatusEnum,
        campaignId: string,
    ): Promise<UpdatedAdminMetaCampaignDto>;

    deleteCampaign(
        status: AdminCampaignsListStatusEnum,
        campaignId: string
    ): Promise<void>;

    getDetailedCampaign(
        status: AdminCampaignsListStatusEnum,
        campaignId: string
    ): Promise<AdminCampaignDetailsDto>;

    // Orchestrator that will define method for updating campaign by campaign status
    updateCampaign(
        status: AdminCampaignsListStatusEnum,
        campaignId: string,
        data: UpdateCampaignDto
    ): Promise<AdminCampaignDetailsDto>;
}

@Injectable()
export class AdminCampaignsService implements IAdminCampaignsService {
    constructor(
        private readonly campaignsRepository: CampaignRepository,
        private readonly completedCampaignsRepository: CompletedCampaignRepository,
        private readonly proposalCampaignRepository: ProposalCampaignRepository,
        private readonly campaignDetailsService: CampaignDetailsService,
        private readonly campaignUpdateService: CampaignUpdateService,
        private readonly campaignAccountsBuilderService: CampaignAccountsBuilderService,
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

    // Repository orchestrator
    private getRepository = (status: AdminCampaignsListStatusEnum) => {
        switch (status) {
            case AdminCampaignsListStatusEnum.distributing:
            case AdminCampaignsListStatusEnum.pending:
                return this.campaignsRepository;

            case AdminCampaignsListStatusEnum.proposal:
                return this.proposalCampaignRepository;

            case AdminCampaignsListStatusEnum.completed:
                return this.completedCampaignsRepository;

            default:
                throw new BadRequestException(`Unsupported campaign status: ${status}`);
        }
    };

    // Updates fields in ongoing campaign
    private async updateOngoingCampaign(
        campaignId: string,
        data: UpdateCampaignDto,
    ): Promise<AdminCampaignDetailsDto> {
        return this.campaignUpdateService.execute<
            HydratedDocument<Campaign>,
            CampaignAccount,
            IAdminCampaignDetails,
            AdminCampaignDetailsDto
        >(campaignId, data, {
            findCampaign: (campaignId: string) =>
                this.campaignsRepository.findOne({ _id: new ObjId(campaignId) }),

            buildCampaignAccountsBatch:
                this.campaignAccountsBuilderService.buildCampaignAccountsBatch.bind(
                    this.campaignAccountsBuilderService,
                ),

            toReadModel: (campaign: HydratedDocument<Campaign>): IAdminCampaignDetails =>
                mapSchemaToIAdminCampaignDetails(campaign.toObject() as Campaign),

            mapResult: (readModel: IAdminCampaignDetails): AdminCampaignDetailsDto =>
                mapToAdminCampaignDetailsDto(readModel),
        });
    }

    async getCampaignsList(data: GetAdminCampaignsListQueryDto): Promise<AdminCampaignsListResponseDto> {
        const page = data.page ?? 1;
        const limit = data.limit ?? 10;
        const skip = (page - 1) * limit;
        const take = skip + limit;

        let ongoingResult = {items: [], total: 0};
        let completedResult = {items: [], total: 0};
        let proposalResult = {items: [], total: 0};

        if (!data.status) {
            [ongoingResult, completedResult, proposalResult] = await Promise.all([
                this.campaignsRepository.getOngoingCampaignsForAdmin(data, take),
                this.completedCampaignsRepository.getCompletedCampaignsForAdmin(data, take),
                this.proposalCampaignRepository.getProposalCampaignsForAdmin(data, take),
            ]);
        } else if (data.status === AdminCampaignsListStatusEnum.proposal) {
            proposalResult = await this.proposalCampaignRepository.getProposalCampaignsForAdmin(data, take);
        } else if (data.status === AdminCampaignsListStatusEnum.completed) {
            completedResult = await this.completedCampaignsRepository.getCompletedCampaignsForAdmin(data, take);
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
            this.completedCampaignsRepository.getCompletedCampaignsForAdmin(data, take),
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

    async updateMeta(
        payload: UpdateAdminMetaCampaignDto,
        status: AdminCampaignsListStatusEnum,
        campaignId: string,
    ): Promise<UpdatedAdminMetaCampaignDto> {
        const entry = Object.entries(payload).find(([, value]) => value !== undefined);

        if (!entry) {
            throw new BadRequestException('No adminMeta field provided');
        }

        const [field, value] = entry;

        if (!Object.values(CampaignAdminMetaEnum).includes(field as CampaignAdminMetaEnum)) {
            throw new BadRequestException('Invalid adminMeta field provided');
        }

        const repository = this.getRepository(status);

        const updatedCampaign: Campaign | CompletedCampaign | ProposalCampaign = await repository.updateAdminMetaField(
            campaignId,
            field as CampaignAdminMetaEnum,
            value as string | boolean,
        );

        if (!updatedCampaign) {
            throw new NotFoundException('Campaign not found');
        }

        return {
            [field]: updatedCampaign.adminMeta?.[field as CampaignAdminMetaEnum],
        } as UpdatedAdminMetaCampaignDto;
    }

    async deleteCampaign(status: AdminCampaignsListStatusEnum, campaignId: string): Promise<void> {
        const repository = this.getRepository(status);
        await repository.deleteById(campaignId);
    }

    async getDetailedCampaign(status: AdminCampaignsListStatusEnum, campaignId: string): Promise<AdminCampaignDetailsDto> {
        const repository = this.getRepository(status);

        return await this.campaignDetailsService.execute(
            campaignId,
            {
                findCampaign: async (campaignId) => await repository.getDetailedCampaignForAdmin(campaignId),
                mapResult: mapToAdminCampaignDetailsDto
            }
        )
    }

    async updateCampaign(status: AdminCampaignsListStatusEnum, campaignId: string, data: UpdateCampaignDto): Promise<AdminCampaignDetailsDto> {
        switch (status) {
            case AdminCampaignsListStatusEnum.distributing:
            case AdminCampaignsListStatusEnum.pending:
                return this.updateOngoingCampaign(campaignId, data);

            case AdminCampaignsListStatusEnum.proposal:
                throw new BadRequestException("You can't update proposal campaign now");

            case AdminCampaignsListStatusEnum.completed:
                throw new BadRequestException("You can't make general updates for completed campaigns");

            default:
                throw new BadRequestException(`Unsupported campaign status: ${status}`);
        }
    }
}
