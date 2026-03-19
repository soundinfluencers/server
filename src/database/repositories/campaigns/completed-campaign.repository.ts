import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {CompletedCampaign} from "../../schemas/campaign/completed-campaign.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";
import {
    CampaignConfirmationEnum,
    CampaignStatusEnum, ICampaignDetails,
    IDashboardCampaign
} from "../../../common/types/client/campaign.types";
import {Campaign} from "../../schemas/campaign/campaign.schema";
import {mapSchemaToICampaignDetails} from "../../../common/mappers/campaign.mapper";

// Interface for completed campaigns repository
interface ICompletedCampaignRepository {
    // Get paginated list of dashboard completed campaigns
    getDashboardCampaigns(
        clientId: string,
        limit: number,
        skip: number,
    ): Promise<IDashboardCampaign[]>;

    // Get detailed campaign information
    getDetailedCampaign(
        clientId: string,
        campaignId: string,
    ): Promise<ICampaignDetails>;
}

@Injectable()
export class CompletedCampaignRepository extends BaseRepository<CompletedCampaign> implements ICompletedCampaignRepository {
    constructor(
        @InjectModel(CompletedCampaign.name)
        private readonly completedCampaignModel: Model<CompletedCampaign>
    ) {
        super(completedCampaignModel);
    }

    async getDashboardCampaigns(
        clientId: string,
        limit: number = 10,
        skip: number = 0,
    ): Promise<IDashboardCampaign[]> {
        const campaigns: Campaign[] = await this.completedCampaignModel
            .find({
                $or: [
                    {clientId: new Types.ObjectId(clientId)},
                    {userId: new Types.ObjectId(clientId)},
                ],
            })
            .lean()
            .limit(limit)
            .skip(skip)
            .exec();

        return campaigns.map((campaign: Campaign): IDashboardCampaign => ({
            _id: campaign._id,
            campaignName: campaign.campaignName,
            socialMedia: campaign.socialMedia,
            createdAt: campaign.createdAt,
            price: campaign.campaignPrice,
            clientStatus: "closed"
        }));
    }

    async getDetailedCampaign(
        clientId: string,
        campaignId: string
    ): Promise<ICampaignDetails> {
        const campaign = await this.completedCampaignModel.findOne({
            _id: new Types.ObjectId(campaignId),
            clientId: new Types.ObjectId(clientId),
        })

        return mapSchemaToICampaignDetails(campaign);
    }
}