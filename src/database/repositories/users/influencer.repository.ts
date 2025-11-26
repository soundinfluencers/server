import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";
import {applyLean} from "../../utils/apply-lean.util";
import {RepoOptions} from "../../types/repo.types";
import {BaseRepository} from "../base.repository";
import {Influencer} from "../../schemas/users/influencer.schema";

@Injectable()
export class InfluencerRepository extends BaseRepository<Influencer> {
    constructor(
        @InjectModel(Influencer.name)
        private influencerModel: Model<Influencer>,
    ) {
        super(influencerModel);
    }

    async findInfluencerByFirstName(firstName: string, options?: RepoOptions): Promise<Influencer> {
        const query = this.influencerModel.findOne({ firstName });
        return applyLean(query, options);
    }

    async findInfluencerByEmail(email: string, options?: RepoOptions): Promise<Influencer> {
        const query = this.influencerModel.findOne({ email })
        return applyLean(query, options);
    }

    async findInfluencerByPhone(phone: string, options?: RepoOptions): Promise<Influencer> {
        const query = this.influencerModel.findOne({ phone })
        return applyLean(query, options);
    }
}