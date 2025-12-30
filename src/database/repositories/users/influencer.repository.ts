import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";
import {RepoOptions} from "../../types/repo.types";
import {BaseRepository} from "../base.repository";
import {Influencer, SocialAccount} from "../../schemas/users/influencer.schema";
import {applyQueryOptions} from "../../utils/apply-query-options.util";

@Injectable()
export class InfluencerRepository extends BaseRepository<Influencer> {
    constructor(
        @InjectModel(Influencer.name)
        private influencerModel: Model<Influencer>,
    ) {
        super(influencerModel);
    }

    // Find influencer by first name
    async findInfluencerByFirstName(firstName: string, options?: RepoOptions): Promise<Influencer> {
        const query = this.influencerModel.findOne({ firstName });
        return applyQueryOptions(query, options);
    }

    // Find influencer by email
    async findInfluencerByEmail(email: string, options?: RepoOptions): Promise<Influencer> {
        const query = this.influencerModel.findOne({ email })
        return applyQueryOptions(query, options);
    }

    // Find influencer by phone number
    async findInfluencerByPhone(phone: string, options?: RepoOptions): Promise<Influencer> {
        const query = this.influencerModel.findOne({ phone })
        return applyQueryOptions(query, options);
    }

    // Find influencer by social account
    async findBySocialAccount(
        socialMedia: keyof Influencer,
        socialAccountId: Types.ObjectId,
        options?: RepoOptions,
    ): Promise<Influencer | null> {
        const query = this.influencerModel.findOne({
            [`${socialMedia}._id`]: socialAccountId,
        });
        return applyQueryOptions(query, options);
    }

    // Delete social account from accounts array
    async pullSocialAccount(
        influencerId: Types.ObjectId,
        socialMedia: keyof Influencer,
        socialAccountId: Types.ObjectId,
        options?: RepoOptions,
    ) {
        return this.influencerModel.updateOne(
            { _id: influencerId },
            { $pull: { [socialMedia]: { _id: socialAccountId } } },
            options,
        );
    }

    // Add social account to accounts array
    async pushSocialAccount(
        influencerId: Types.ObjectId,
        socialMedia: keyof Influencer,
        socialAccount: SocialAccount,
        options?: RepoOptions,
    ) {
        return this.influencerModel.updateOne(
            { _id: influencerId },
            { $push: { [socialMedia]: socialAccount } },
            options,
        );
    }

    // Check availability of social account
    async hasSocialAccount(
        influencerId: Types.ObjectId,
        socialMedia: keyof Influencer,
        socialAccountId: Types.ObjectId,
        options?: RepoOptions,
    ): Promise<boolean> {
        const query = this.influencerModel.exists({
            _id: influencerId,
            [`${socialMedia}._id`]: socialAccountId,
        });
        return !!(await applyQueryOptions(query, options));
    }

    // Get all influencer's social accounts of a specific type
    async getSocialAccounts(
        influencerId: Types.ObjectId,
        socialMedia: keyof Influencer,
        options?: RepoOptions,
    ) {
        const query = this.influencerModel.findById(influencerId).select(socialMedia);
        return applyQueryOptions(query, options);
    }

    // Get influencer's social account by socialAccountId
    async getSocialAccountById(
        socialAccountId: Types.ObjectId,
        options?: RepoOptions,
    ) {
        const query = this.influencerModel.find({

        })
    }
}