import {Injectable, NotFoundException} from "@nestjs/common";
import {BaseRepository} from "../base.repository";
import {Offer} from "../../schemas/offer/offer.schema";
import {InjectModel} from "@nestjs/mongoose";
import {DeleteResult, FilterQuery, Model, PipelineStage} from "mongoose";
import {OfferAccountLink} from "../../schemas/offer/offer-account-link.schema";
import {Influencer} from "../../schemas/users/influencer.schema";
import {ObjId} from "../../../common/types/base.types";
import {
    OfferFieldRecord,
    OffersMatrixAccountCursor,
    OffersMatrixOfferCursor,
    UpdateOfferFieldInput
} from "../../../modules/admin/services/admin-offers.service";
import {SocialMediaEnum} from "../../../common/types/social-media.types";

export type OfferHeaderRow = {
    offerId: ObjId;
    title: string;
    isPublished: boolean;
    price: number;
    createdAt: Date;
};

export type OffersMatrixAccountRow = {
    influencerId: ObjId;
    accountId: ObjId;
    username: string;
    logoUrl?: string;
    sortUsername: string;
};

// Interface for offer repository
interface IOfferRepository {
    // Updates many offers' published status (Opposite value of first offer)
    updatePublishedStatusMany(): Promise<void>;

    // Updates one offer's published status (Opposite value of this offer)
    updatePublishedStatusOne(offerId: string): Promise<void>;

    // Updates one offer's field
    updateOneField<K extends keyof OfferFieldRecord>(
        input: UpdateOfferFieldInput<K>,
    ): Promise<Offer | null>;

    // Delete offer and all related offer account links
    delete(offerId: string): Promise<DeleteResult | null>;

    // Get cursor paginated offer headers (matrix columns)
    getOffersHeadersPage(params: {
        socialMedia: SocialMediaEnum;
        genre: string;
        take: number;
        cursor?: OffersMatrixOfferCursor | null;
    }): Promise<OfferHeaderRow[]>;

    // Get cursor paginated influencer account rows for the offers matrix (matrix rows)
    getOffersMatrixAccountRowsPage(params: {
        socialMedia: SocialMediaEnum;
        genre: string;
        take: number;
        cursor?: OffersMatrixAccountCursor | null;
    }): Promise<OffersMatrixAccountRow[]>;
}

@Injectable()
export class OfferRepository extends BaseRepository<Offer> implements IOfferRepository {
    constructor(
        @InjectModel(Offer.name) private readonly offerModel: Model<Offer>,
        @InjectModel(OfferAccountLink.name) private readonly offerAccountLinkModel: Model<OfferAccountLink>,
        @InjectModel(Influencer.name) private readonly influencerModel: Model<Influencer>,
    ) {
        super(offerModel);
    }

    async updatePublishedStatusMany(): Promise<void> {
        // Get first offer
        const firstOffer = await this.offerModel
            .findOne()
            .select('isPublished')
            .lean();

        // Opposite value of first offer
        const firstValue = firstOffer?.isPublished ?? false;

        // Update all offers' published status
        await this.offerModel.updateMany({}, {
            $set: { isPublished: !firstValue }
        });
    }

    async updatePublishedStatusOne(offerId: string): Promise<void> {
        const offerObjectId = new ObjId(offerId);

        const result = await this.offerModel.updateOne(
            { _id: offerObjectId },
            [
                {
                    $set: {
                        isPublished: { $not: '$isPublished' },
                    },
                },
            ],
        );

        if (result.matchedCount === 0) {
            throw new NotFoundException('Offer not found');
        }
    }

    async updateOneField<K extends keyof OfferFieldRecord>(
        input: UpdateOfferFieldInput<K>,
    ): Promise<Offer | null> {
        const offerObjectId = new ObjId(input.offerId);

        return this.offerModel.findByIdAndUpdate(
            offerObjectId,
            {
                $set: {
                    [input.field]: input.value,
                },
            },
            {
                new: true,
            },
        );
    }

    async getOffersHeadersPage(params: {
        socialMedia: SocialMediaEnum;
        genre: string;
        take: number;
        cursor?: OffersMatrixOfferCursor | null;
    }): Promise<OfferHeaderRow[]> {
        const {socialMedia, genre, take, cursor} = params;

        const filter: FilterQuery<Offer> = {
            socialMedia,
            genre,
            isDeleted: false,
        };

        if (cursor) {
            const cAt = new Date(cursor.createdAt);
            const oid = new ObjId(cursor.offerId);
            filter.$or = [
                {createdAt: {$lt: cAt}},
                {$and: [{createdAt: cAt}, {_id: {$lt: oid}}]},
            ];
        }

        const rows = await this.offerModel
            .find(filter)
            .sort({createdAt: -1, _id: -1})
            .limit(take + 1)
            .lean()
            .exec();

        return rows.map((row) => ({
            offerId: row._id as ObjId,
            title: row.title,
            isPublished: row.isPublished,
            price: row.price,
            createdAt: row.createdAt ?? new Date(0),
        }));
    }

    async getOffersMatrixAccountRowsPage(params: {
        socialMedia: SocialMediaEnum;
        genre: string;
        take: number;
        cursor?: OffersMatrixAccountCursor | null;
    }): Promise<OffersMatrixAccountRow[]> {
        const {socialMedia, genre, take, cursor} = params;
        const sm = socialMedia as string;

        const pipeline: PipelineStage[] = [
            {$unwind: {path: `$${sm}`, preserveNullAndEmptyArrays: false}},
            {
                $match: {
                    [`${sm}.isDeleted`]: {$ne: true},
                    [`${sm}.isHidden`]: {$ne: true},
                },
            },
            {
                $addFields: {
                    genreLabels: {
                        $reduce: {
                            input: {$ifNull: [`$${sm}.musicGenres`, []]},
                            initialValue: [],
                            in: {
                                $concatArrays: [
                                    '$$value',
                                    {
                                        $cond: [
                                            {$gt: [{$size: '$$this.subGenres'}, 0]},
                                            {
                                                $map: {
                                                    input: '$$this.subGenres',
                                                    as: 'sub',
                                                    in: {
                                                        $concat: ['$$this.genre', ' (', '$$sub', ')'],
                                                    },
                                                },
                                            },
                                            ['$$this.genre'],
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                    sortUsername: {$toLower: {$ifNull: [`$${sm}.username`, '']}},
                },
            },
            {
                $match: {
                    $expr: {$in: [genre, '$genreLabels']},
                },
            },
            {
                $project: {
                    _id: 0,
                    influencerId: '$_id',
                    accountId: `$${sm}._id`,
                    username: `$${sm}.username`,
                    logoUrl: `$${sm}.logoUrl`,
                    sortUsername: 1,
                },
            },
            {$sort: {sortUsername: 1, influencerId: 1, accountId: 1}},
        ];

        if (cursor) {
            const infId = new ObjId(cursor.influencerId);
            const accId = new ObjId(cursor.accountId);
            pipeline.push({
                $match: {
                    $or: [
                        {sortUsername: {$gt: cursor.sortUsername}},
                        {
                            $and: [
                                {sortUsername: cursor.sortUsername},
                                {influencerId: {$gt: infId}},
                            ],
                        },
                        {
                            $and: [
                                {sortUsername: cursor.sortUsername},
                                {influencerId: infId},
                                {accountId: {$gt: accId}},
                            ],
                        },
                    ],
                },
            });
        }

        pipeline.push({$limit: take + 1});

        return this.influencerModel.aggregate<OffersMatrixAccountRow>(pipeline);
    }

    async delete(offerId: string): Promise<DeleteResult | null> {
        const session = await this.offerModel.startSession();
        const offerObjectId = new ObjId(offerId);

        try {
            let result: DeleteResult | null = null;

            await session.withTransaction(async () => {
                // Delete all related offer account links
                await this.offerAccountLinkModel.deleteMany(
                    { offerId: offerObjectId },
                    { session }
                );

                // Delete offer
                result = await this.offerModel.deleteOne(
                    { _id: offerObjectId },
                    { session }
                );
            });

            return result;
        } finally {
            await session.endSession();
        }
    }
}