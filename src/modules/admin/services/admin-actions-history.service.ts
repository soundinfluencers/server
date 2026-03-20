import {Injectable, Logger, NotFoundException} from '@nestjs/common';
import {InfluencerRepository} from "../../../database/repositories/users/influencer.repository";
import {InfluencerHistoryRepository} from "../../../database/repositories/histories/influencer-history.repository";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {AdminInfActionsHistoryDto} from "../dto/histories/admin-inf-history.dto";
import {mapInfHistoryToAdminHistoryDto} from "../../../common/mappers/history.mapper";
import {ShortSocialAccountInfo} from "../../../common/types/influencer/influencer.types";
import {SocialMediaEnum} from "../../../common/types/social-media.types";

// Interface for AdminActionsHistoryService
export interface IAdminActionsHistory {
    // todo: remove any response type
    // Get influencer's actions history
    getInfluencerHistory(
        influencerId: string,
        query: PaginationQueryDto
    ): Promise<{
        history: AdminInfActionsHistoryDto;
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;

    // Check if social account still in campaign
    checkIfAccountStillInCampaign(campaignId: string, accountId: string): Promise<boolean>;
}

@Injectable()
export class AdminActionsHistoryService implements IAdminActionsHistory {
    constructor(
        private readonly influencerRepo: InfluencerRepository,
        private readonly historyRepo: InfluencerHistoryRepository
    ) {
    }

    private readonly logger = new Logger('AdminActionsHistoryService');

    async getInfluencerHistory(
        influencerId: string,
        query: PaginationQueryDto
    ): Promise<{
        history: AdminInfActionsHistoryDto;
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        // Find influencer
        const influencer = await this.influencerRepo.findById(influencerId);

        if (!influencer) {
            throw new NotFoundException(`Influencer ${influencerId} not found`);
        }

        // Get influencer's actions history
        const influencerActionsHistory = await this.historyRepo.findPaginated(
            influencerId,
            query
        );

        if (!influencerActionsHistory.history) {
            throw new NotFoundException(`History for influencer ${influencerId} was not found`);
        }

        // Checking if there's firstName in influencer object
        const processedName = influencer.firstName.trim()
            ? influencer.firstName.trim()
            : influencer.email.includes('@')
                ? influencer.email.split('@')[0]
                : influencer.email;

        const accounts: ShortSocialAccountInfo[] = [];

        // Collecting influencer's social accounts
        Object.values(SocialMediaEnum).flatMap((socialMedia) =>
            (influencer[socialMedia] ?? []).map((account) => {
                accounts.push({
                    accountId: account._id.toString(),
                    socialMedia,
                    username: account.username,
                    price: account.price,
                })
            }),
        );

        if (accounts.length === 0) {
            throw new NotFoundException(`Didn't find any account for ${influencer.email}`);
        }

        return {
            history: mapInfHistoryToAdminHistoryDto(
                influencerActionsHistory.history,
                processedName,
                accounts,
                influencer.currencyNote
            ),
            total: influencerActionsHistory.total,
            page: influencerActionsHistory.page,
            limit: influencerActionsHistory.limit,
            totalPages: influencerActionsHistory.totalPages
        }
    }

    checkIfAccountStillInCampaign(campaignId: string, accountId: string): Promise<boolean> {
        // todo: finish
        return null;
    }
}
