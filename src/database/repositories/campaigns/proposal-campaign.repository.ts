import {BaseRepository} from "../base.repository";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";
import {RepoOptions} from "../../types/repo.types";
import {applyQueryOptions} from "../../utils/apply-query-options.util";
import {ProposalCampaign} from "../../schemas/campaign/proposal-campaign.schema";

@Injectable()
export class ProposalCampaignRepository extends BaseRepository<ProposalCampaign> {
    constructor(
        @InjectModel(ProposalCampaign.name)
        private readonly proposalCampaignModel: Model<ProposalCampaign>,
    ) {
        super(proposalCampaignModel);
    }
}