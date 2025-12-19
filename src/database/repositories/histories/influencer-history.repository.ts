import {BaseRepository} from "../base.repository";
import {CampaignAction, InfluencerActionsHistory} from "../../schemas/histories/influencer-actions-history.schema";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";
import {RepoOptions} from "../../types/repo.types";
import {applyQueryOptions} from "../../utils/apply-query-options.util";
import {SocialMediaType} from "../../../common/types/social-media.types";
import {CampaignActionWithCampaignMeta} from "../../types/histories/influencer-history.types";

@Injectable()
export class InfluencerHistoryRepository extends BaseRepository<InfluencerActionsHistory> {
    constructor(
        @InjectModel(InfluencerActionsHistory.name)
        private readonly influencerHistoryModel: Model<InfluencerActionsHistory>,
    ) {
        super(influencerHistoryModel);
    }

    // Find influencer's history by influencerId
    async findHistoryByInfluencerId(influencerId: string, options?: RepoOptions): Promise<InfluencerActionsHistory> {
        const query = this.influencerHistoryModel.findOne({influencerId: new Types.ObjectId(influencerId)});
        return applyQueryOptions(query, options);
    }

    // Find influencer's history by influencer's email
    async findHistoryByInfluencerEmail(email: string, options?: RepoOptions): Promise<InfluencerActionsHistory> {
        const query = this.influencerHistoryModel.findOne({influencerEmail: email});
        return applyQueryOptions(query, options);
    }

    // Find all campaign actions for specific social account (by social account's username, social media, influencer's id)
    async findCampaignActionsForSocialAccount(
        request: {
            influencerId: string;
            socialAccountUsername: string;
            socialMedia: SocialMediaType;
        },
        options?: RepoOptions,
    ): Promise<CampaignActionWithCampaignMeta[]> {

        const pipeline: any[] = [
            {
                $match: {
                    influencerId: new Types.ObjectId(request.influencerId),
                },
            },
            { $unwind: '$campaigns' },
            { $unwind: '$campaigns.actions' },
            {
                $match: {
                    'campaigns.actions.networkUsername': request.socialAccountUsername,
                    'campaigns.actions.socialMedia': request.socialMedia,
                },
            },
            {
                $project: {
                    _id: 0,

                    // campaign meta data
                    campaignId: '$campaigns.campaignId',
                    campaignName: '$campaigns.campaignName',

                    // action data
                    action: '$campaigns.actions',
                },
            },
            {
                // union campaign meta + action
                $replaceRoot: {
                    newRoot: {
                        $mergeObjects: ['$action', {
                            campaignId: '$campaignId',
                            campaignName: '$campaignName',
                        }],
                    },
                },
            },
        ];

        const query = this.influencerHistoryModel.aggregate<CampaignActionWithCampaignMeta>(pipeline);

        return applyQueryOptions(query, options);
    }
}