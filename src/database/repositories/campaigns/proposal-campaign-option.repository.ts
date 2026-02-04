import {BaseRepository} from "../base.repository";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";
import {ProposalCampaignOption} from "../../schemas/campaign/proposal-campaign-option.schema";

@Injectable()
export class ProposalCampaignOptionRepository extends BaseRepository<ProposalCampaignOption> {
    constructor(
        @InjectModel(ProposalCampaignOption.name)
        private readonly proposalOptionModel: Model<ProposalCampaignOption>,
    ) {
        super(proposalOptionModel);
    }
}