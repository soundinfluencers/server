import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {CompletedCampaign} from "../../schemas/campaign/completed-campaign.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

@Injectable()
export class CompletedCampaignRepository extends BaseRepository<CompletedCampaign> {
    constructor(
        @InjectModel(CompletedCampaign.name)
        private readonly completedCampaignModel: Model<CompletedCampaign>
    ) {
        super(completedCampaignModel);
    }

    
}