import {Injectable} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {BespokeCampaignRequest} from "../../schemas/campaign/bespoke-campaign.schema";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

@Injectable()
export class BespokeCampaignRepository extends BaseRepository<BespokeCampaignRequest> {
    constructor(
        @InjectModel(BespokeCampaignRequest.name)
        private readonly bespokeCampaign: Model<BespokeCampaignRequest>
    ) {
        super(bespokeCampaign);
    }
}