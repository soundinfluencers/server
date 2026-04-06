import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, PipelineStage, Types, UpdateWriteOpResult} from "mongoose";
import {RepoOptions} from "../../types/repo.types";
import {BaseRepository} from "../base.repository";
import {Influencer, SocialAccount} from "../../schemas/users/influencer.schema";
import {applyQueryOptions} from "../../utils/apply-query-options.util";
import {AdminInfluencerListItem} from "../../../common/types/influencer/influencer.types";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {AdminInfluencersQueryDto} from "../../../modules/admin/dto/influencers/admin-influencers-query.dto";

// Interface for InfluencerRepository
interface IInfluencerRepository {
    // Find one influencer by email
    findInfluencerByEmail(email: string, options?: RepoOptions): Promise<Influencer>;

    // Find one influencer by phone number
    findInfluencerByPhone(phone: string, options?: RepoOptions): Promise<Influencer>;

    // Find influencer by social account
    findBySocialAccount(
        socialMedia: keyof Influencer,
        socialAccountId: Types.ObjectId,
        options?: RepoOptions,
    ): Promise<Influencer | null>;

    // Delete social account from accounts array
    pullSocialAccount(
        influencerId: Types.ObjectId,
        socialMedia: keyof Influencer,
        socialAccountId: Types.ObjectId,
        options?: RepoOptions,
    ): Promise<UpdateWriteOpResult>;

    // Add social account to accounts array
    pushSocialAccount(
        influencerId: Types.ObjectId,
        socialMedia: keyof Influencer,
        socialAccount: SocialAccount,
        options?: RepoOptions,
    ): Promise<UpdateWriteOpResult>;

    // Check availability of social account
    hasSocialAccount(
        influencerId: Types.ObjectId,
        socialMedia: keyof Influencer,
        socialAccountId: Types.ObjectId,
        options?: RepoOptions,
    ): Promise<boolean>

    // Get paginated list of influencer accounts with optional platform filter and search
    findInfluencers(query: AdminInfluencersQueryDto): Promise<{
        items: AdminInfluencerListItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
}

@Injectable()
export class InfluencerRepository extends BaseRepository<Influencer> implements IInfluencerRepository {
    constructor(
        @InjectModel(Influencer.name)
        private influencerModel: Model<Influencer>,
    ) {
        super(influencerModel);
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

    // Get paginated list of influencer accounts with optional platform filter and search
    async findInfluencers(query: AdminInfluencersQueryDto): Promise<{
        items: AdminInfluencerListItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;
        const platform = query.platform;

        const rawSearch = query.search?.trim();
        const escapedSearch = rawSearch
            ? rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            : null;

        const accountsProjection = platform
            ? {
                $map: {
                    input: `$${platform}`,
                    as: 'acc',
                    in: {
                        _id: '$$acc._id',
                        username: '$$acc.username',
                        socialMedia: { $literal: platform },
                        logoUrl: '$$acc.logoUrl',
                        followers: '$$acc.followers',
                        profileLink: '$$acc.profileLink',
                        publicPrice: '$$acc.publicPrice',
                        price: '$$acc.price',
                        initialPrice: '$$acc.initialPrice',
                        currency: '$$acc.currency',
                        isHidden: '$$acc.isHidden',
                    },
                },
            }
            : {
                $concatArrays: Object.values(SocialMediaEnum).map((sm) => ({
                    $map: {
                        input: `$${sm}`,
                        as: 'acc',
                        in: {
                            _id: '$$acc._id',
                            username: '$$acc.username',
                            socialMedia: sm,
                            logoUrl: '$$acc.logoUrl',
                            followers: '$$acc.followers',
                            profileLink: '$$acc.profileLink',
                            publicPrice: '$$acc.publicPrice',
                            price: '$$acc.price',
                            initialPrice: '$$acc.initialPrice',
                            currency: '$$acc.currency',
                            isHidden: '$$acc.isHidden',
                        },
                    },
                })),
            };

        const matchStage: PipelineStage[] = platform
            ? [{ $match: { [`${platform}.0`]: { $exists: true } } }]
            : [];

        const searchStage: PipelineStage[] = escapedSearch
            ? [{ $match: { 'accounts.username': { $regex: escapedSearch, $options: 'i' } } }]
            : [];

        const basePipeline: PipelineStage[] = [
            ...matchStage,
            {
                $project: {
                    influencerId: '$_id',
                    firstName: 1,
                    lastName: 1,
                    email: 1,
                    phone: 1,
                    balance: 1,
                    internalNote: 1,
                    createdAt: 1,
                    accounts: accountsProjection,
                },
            },
            { $unwind: '$accounts' },
            ...searchStage,
        ];

        const finalProjection: PipelineStage = {
            $project: {
                _id: 0,
                influencerId: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                phone: 1,
                balance: 1,
                internalNote: 1,

                accountId: '$accounts._id',
                username: '$accounts.username',
                socialMedia: '$accounts.socialMedia',
                logoUrl: '$accounts.logoUrl',
                followers: '$accounts.followers',
                profileLink: '$accounts.profileLink',
                publicPrice: '$accounts.publicPrice',
                price: '$accounts.price',
                initialPrice: '$accounts.initialPrice',
                currency: '$accounts.currency',
                isHidden: '$accounts.isHidden',

                costPerFollower: {
                    $cond: [
                        { $gt: ['$accounts.followers', 0] },
                        {
                            $round: [
                                { $divide: ['$accounts.price', '$accounts.followers'] },
                                6,
                            ],
                        },
                        0,
                    ],
                },
            },
        };

        const [items, totalResult] = await Promise.all([
            this.influencerModel.aggregate<AdminInfluencerListItem>([
                ...basePipeline,
                { $sort: { createdAt: -1 } },
                { $skip: skip },
                { $limit: limit },
                finalProjection,
            ]),
            this.influencerModel.aggregate([
                ...basePipeline,
                { $count: 'total' },
            ]),
        ]);

        const total = totalResult[0]?.total ?? 0;

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
}