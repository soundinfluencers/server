import {BaseRepository} from "../base.repository";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Query, Types} from "mongoose";
import {RepoOptions} from "../../types/repo.types";
import {applyQueryOptions} from "../../utils/apply-query-options.util";
import {ProposalCampaign} from "../../schemas/campaign/proposal-campaign.schema";
import {Role} from "../../../common/types/user.types";

@Injectable()
export class ProposalCampaignRepository extends BaseRepository<ProposalCampaign> {
    constructor(
        @InjectModel(ProposalCampaign.name)
        private readonly proposalCampaignModel: Model<ProposalCampaign>,
    ) {
        super(proposalCampaignModel);
    }

    async findAccessibleById(args: {
        campaignId: Types.ObjectId,
        userId: Types.ObjectId,
        userRole: Role
    }, options?: RepoOptions): Promise<ProposalCampaign> {
        let query: Query<ProposalCampaign | null, ProposalCampaign>;

        switch (args.userRole) {
            case Role.client:
                query = this.proposalCampaignModel.findOne({
                    _id: args.campaignId,
                    creatorId: args.userId,
                    creatorRole: args.userRole
                });
                break;
            case Role.admin:
                query = this.proposalCampaignModel.findOne({_id: args.campaignId});
                break;
            default:
                return null;
        }

        return applyQueryOptions(query, options);
    }
}