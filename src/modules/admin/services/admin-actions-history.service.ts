import {Injectable, InternalServerErrorException, Logger, NotFoundException} from '@nestjs/common';
import {InfluencerRepository} from "../../../database/repositories/users/influencer.repository";
import {InfluencerHistoryRepository} from "../../../database/repositories/histories/influencer-history.repository";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {AdminInfActionsHistoryDto} from "../dto/histories/admin-inf-history.dto";
import {mapInfHistoryToAdminHistoryDto} from "../../../common/mappers/history.mapper";
import {ShortSocialAccountInfo} from "../../../common/types/influencer/influencer.types";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {CampaignRepository} from "../../../database/repositories/campaigns/campaign.repository";

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
        private readonly historyRepo: InfluencerHistoryRepository,
        private readonly campaignRepo: CampaignRepository,
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

    async checkIfAccountStillInCampaign(
        influencerId: string,
        actionId: string,
    ): Promise<boolean> {
        // Find campaign action with needed information
        const campaignAction = await this.historyRepo.findCampaignAction(influencerId, actionId);

        if (
            !campaignAction ||
            campaignAction.campaignIndex == null ||
            campaignAction.actionIndex == null
        ) {
            throw new NotFoundException('This action was not found');
        }

        if (!campaignAction.addedAccountsId) {
            throw new InternalServerErrorException("This action isn't supportable in new website version")
        }

        // Find out is social account still in campaign
        const exists = await this.campaignRepo.checkIfAccountStillInCampaign(campaignAction.campaignId.toString(), campaignAction.addedAccountsId.toString());

        // If account was removed from campaign (even if full campaign was deleted), update isStillInCampaign field
        if (!exists) {
            try {
                const resultOfUpdate = await this.historyRepo.updateStillInCampaign(
                    influencerId,
                    campaignAction.campaignIndex,
                    campaignAction.actionIndex,
                    false
                )

                if (typeof resultOfUpdate !== 'boolean') throw new Error(`isStillInCampaign for influencer: ${influencerId} with campaignIndex: ${campaignAction.campaignIndex} and actionIndex: ${campaignAction.actionIndex} was not updated`);
            } catch (err) {
                this.logger.error(err);
                throw new InternalServerErrorException(`Account was removed from this campaign, but server can't update information about this`);
            }
        }

        return exists;
    }
}
