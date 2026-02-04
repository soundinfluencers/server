import {BaseRepository} from "../base.repository";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";
import {ProposalCampaignOption} from "../../schemas/campaign/proposal-campaign-option.schema";
import {RepoOptions} from "../../types/repo.types";
import {applyQueryOptions} from "../../utils/apply-query-options.util";

@Injectable()
export class ProposalCampaignOptionRepository extends BaseRepository<ProposalCampaignOption> {
    constructor(
        @InjectModel(ProposalCampaignOption.name)
        private readonly proposalOptionModel: Model<ProposalCampaignOption>,
    ) {
        super(proposalOptionModel);
    }

    // find one by index (from old to new)
    async findOneByIndex(
        args: {
            campaignId: Types.ObjectId;
            optionIndex: number;
        },
        options?: RepoOptions,
    ): Promise<ProposalCampaignOption | null> {

        const { campaignId, optionIndex } = args;

        let query = this.proposalOptionModel
            .findOne({ proposalCampaignId: campaignId })
            .sort({ createdAt: 1 })
            .skip(optionIndex);

        return applyQueryOptions(query, options);
    }

}