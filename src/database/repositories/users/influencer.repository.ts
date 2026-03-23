import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, PipelineStage, Types, UpdateWriteOpResult} from "mongoose";
import {RepoOptions} from "../../types/repo.types";
import {BaseRepository} from "../base.repository";
import {Influencer, SocialAccount} from "../../schemas/users/influencer.schema";
import {applyQueryOptions} from "../../utils/apply-query-options.util";
import {PaginationQueryDto} from "../../../common/dto/requests/pagination-query.dto";
import {AdminInfluencerListItem} from "../../../common/types/influencer/influencer.types";
import {SocialMediaEnum} from "../../../common/types/social-media.types";
import {SearchQueryDto} from "../../../common/dto/requests/search-query.dto";

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

    // Get paginated list of influencer accounts
    findPaginated(
        socialMedia: SocialMediaEnum,
        query: PaginationQueryDto,
    ): Promise<{
        items: AdminInfluencerListItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>

    // Find social account by searching username
    findSocialAccountBySearch(query: SearchQueryDto): Promise<{
        items: AdminInfluencerListItem[];
        total: number;
        limit: number;
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

    // Get paginated list of influencer accounts
    // Currently returning read model for admin panel influencers list, but maybe in future will be changed
    async findPaginated(
        socialMedia: SocialMediaEnum,
        query: PaginationQueryDto,
    ): Promise<{
        items: AdminInfluencerListItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const skip = (page - 1) * limit;

        const socialMediaField = socialMedia;

        const basePipeline = [
            {
                $match: {
                    [`${socialMediaField}.0`]: { $exists: true },
                },
            },
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
                    accounts: `$${socialMediaField}`,
                },
            },
            {
                $unwind: '$accounts',
            },
        ];

        const [items, totalResult] = await Promise.all([
            this.influencerModel.aggregate<AdminInfluencerListItem>([
                ...basePipeline,
                { $sort: { createdAt: -1 } },
                { $skip: skip },
                { $limit: limit },
                {
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
                        socialMedia: { $literal: socialMedia },
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
                },
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
    };

    async findSocialAccountBySearch(query: SearchQueryDto): Promise<{
        items: AdminInfluencerListItem[];
        total: number;
        limit: number;
    }> {
        const limit = query.limit ?? 10;
        const rawSearch = query.search?.trim();

        const escapedSearch = rawSearch
            ? rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            : null;

        const accountsConcat = Object.values(SocialMediaEnum).map((socialMedia) => ({
            $map: {
                input: `$${socialMedia}`,
                as: 'acc',
                in: {
                    _id: '$$acc._id',
                    username: '$$acc.username',
                    socialMedia,
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
        }));

        const basePipeline: PipelineStage[] = [
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
                    accounts: {
                        $concatArrays: accountsConcat,
                    },
                },
            },
            {
                $unwind: '$accounts',
            },
            ...(escapedSearch
                ? [
                    {
                        $match: {
                            'accounts.username': { $regex: escapedSearch, $options: 'i' },
                        },
                    },
                ]
                : []),
            {
                $sort: { createdAt: -1 },
            },
            {
                $limit: limit,
            },
            {
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
                                    5,
                                ],
                            },
                            0,
                        ],
                    },
                },
            },
        ];

        const totalPipeline: PipelineStage[] = [
            {
                $project: {
                    accounts: {
                        $concatArrays: accountsConcat,
                    },
                },
            },
            {
                $unwind: '$accounts',
            },
            ...(escapedSearch
                ? [
                    {
                        $match: {
                            'accounts.username': { $regex: escapedSearch, $options: 'i' },
                        },
                    },
                ]
                : []),
            {
                $count: 'total',
            },
        ];

        const [items, totalResult] = await Promise.all([
            this.influencerModel.aggregate<AdminInfluencerListItem>(basePipeline),
            this.influencerModel.aggregate(totalPipeline),
        ]);

        const total = totalResult[0]?.total ?? 0;

        return {
            items,
            total,
            limit,
        };
    }
}