import {BaseRepository} from "../base.repository";
import {Campaign} from "../../schemas/campaign/campaign.schema";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";
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
    async findOngoingPromosByInfluencerId(
        influencerId: string,
        options?: RepoOptions,
    ) {
        const query = this.campaignModel.find({
            selectInfluencers: {
                $elemMatch: {
                    influencerId: new Types.ObjectId(influencerId),
                    closePromo: { $ne: 'closed' },
                },
            },
            statusCampaign: 'ongoing',
        });

        return applyQueryOptions(query, options);
    }

    // Replace influencer id in each influencer's promo
    async replaceInfluencerId(
        oldInfluencerId: string,
        newInfluencerId: string,
        options?: RepoOptions,
    ) {
        return this.campaignModel.updateMany(
            {
                'selectInfluencers.influencerId': new Types.ObjectId(oldInfluencerId),
            },
            {
                $set: {
                    'selectInfluencers.$[elem].influencerId':
                        new Types.ObjectId(newInfluencerId),
                },
            },
            {
                arrayFilters: [
                    { 'elem.influencerId': new Types.ObjectId(oldInfluencerId) },
                ],
            },
        );
    }



    // TODO: Find all ongoing promos for social account (by social account's id)
}