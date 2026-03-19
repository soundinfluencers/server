import {BaseRepository} from "../base.repository";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Query, Types} from "mongoose";
import {RepoOptions} from "../../types/repo.types";
import {applyQueryOptions} from "../../utils/apply-query-options.util";
import {ProposalCampaign} from "../../schemas/campaign/proposal-campaign.schema";
import {Role} from "../../../common/types/user.types";
import {
    CampaignConfirmationEnum,
    CampaignStatusEnum,
    IDashboardCampaign
} from "../../../common/types/client/campaign.types";
import {Campaign} from "../../schemas/campaign/campaign.schema";

// Interface for proposal campaigns repository
interface IProposalCampaignRepository {
    // Get paginated list of dashboard campaigns
    getDashboardCampaigns(
        clientId: string,
        limit: number,
        skip: number,
    ): Promise<IDashboardCampaign[]>;
}

@Injectable()
export class ProposalCampaignRepository extends BaseRepository<ProposalCampaign> implements IProposalCampaignRepository {
    constructor(
        @InjectModel(ProposalCampaign.name)
        private readonly proposalCampaignModel: Model<ProposalCampaign>,
    ) {
        super(proposalCampaignModel);
    }

    async getDashboardCampaigns(
        clientId: string,
        limit: number = 10,
        skip: number = 0,
    ): Promise<IDashboardCampaign[]> {
        const proposalCampaigns: ProposalCampaign[] = await this.proposalCampaignModel
            .find(
                {
                    $or: [
                        {creatorId: new Types.ObjectId(clientId)},
                        {clientId: new Types.ObjectId(clientId)}
                    ]
                }
            )
            .lean()
            .limit(limit)
            .skip(skip)
            .exec();

        return proposalCampaigns.map((campaign: ProposalCampaign): IDashboardCampaign => ({
            _id: campaign._id,
            campaignName: campaign.campaignName,
            socialMedia: campaign.socialMedia,
            createdAt: campaign.createdAt,
            clientStatus: "proposal"
        }));
    }
}