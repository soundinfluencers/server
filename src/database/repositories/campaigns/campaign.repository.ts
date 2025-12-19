import {BaseRepository} from "../base.repository";
import {Campaign} from "../../schemas/campaign/campaign.schema";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";
import {RepoOptions} from "../../types/repo.types";
import {applyQueryOptions} from "../../utils/apply-query-options.util";

@Injectable()
export class CampaignRepository extends BaseRepository<Campaign> {
    constructor(
        @InjectModel(Campaign.name)
        private readonly campaignModel: Model<Campaign>,
    ) {
        super(campaignModel);
    }

    // Find all ongoing promos for influencer (by influencer id)
    async findOngoingPromosByInfluencerId(influencerId: string, options?: RepoOptions) {
        const query = this.campaignModel.findOne({where: {influencerId: influencerId}});
        return applyQueryOptions(query, options);
    }

    // TODO: Find all ongoing promos for social account (by social account's id)
}