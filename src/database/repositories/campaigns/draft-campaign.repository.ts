import {BaseRepository} from "../base.repository";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";
import {DraftCampaign} from "../../schemas/campaign/draft-campaign.schema";

@Injectable()
export class DraftCampaignRepository extends BaseRepository<DraftCampaign> {
    constructor(
        @InjectModel(DraftCampaign.name)
        private readonly draftCampaignModel: Model<DraftCampaign>,
    ) {
        super(draftCampaignModel);
    }
}