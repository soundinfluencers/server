import {Injectable} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';
import {ClientSession, DeleteResult, Model, Types} from 'mongoose';
import {BaseRepository} from '../base.repository';
import {
    OfferAccountLink,
    OfferAccountLinkDocument,
} from '../../schemas/offer/offer-account-link.schema';

export type OfferAccountPair = {
    influencerId: Types.ObjectId;
    accountId: Types.ObjectId;
};

@Injectable()
export class OfferAccountLinkRepository extends BaseRepository<OfferAccountLinkDocument> {
    constructor(
        @InjectModel(OfferAccountLink.name)
        private readonly offerAccountLinkModel: Model<OfferAccountLinkDocument>,
    ) {
        super(offerAccountLinkModel);
    }

    async insertLinks(
        offerId: Types.ObjectId,
        pairs: OfferAccountPair[],
        session?: ClientSession,
    ): Promise<void> {
        if (!pairs.length) {
            return;
        }
        await this.offerAccountLinkModel.insertMany(
            pairs.map((p) => ({
                offerId,
                influencerId: p.influencerId,
                accountId: p.accountId,
            })),
            {session, ordered: false},
        );
    }

    async deleteByOfferId(offerId: Types.ObjectId | string, session?: ClientSession): Promise<DeleteResult> {
        return this.offerAccountLinkModel.deleteMany(
            {offerId: new Types.ObjectId(offerId)},
            {session},
        );
    }

    async addLink(
        offerId: Types.ObjectId,
        influencerId: Types.ObjectId,
        accountId: Types.ObjectId,
        session?: ClientSession,
    ): Promise<void> {
        await this.offerAccountLinkModel.updateOne(
            {offerId, influencerId, accountId},
            {$setOnInsert: {offerId, influencerId, accountId}},
            {upsert: true, session},
        );
    }

    async removeLink(
        offerId: Types.ObjectId,
        influencerId: Types.ObjectId,
        accountId: Types.ObjectId,
        session?: ClientSession,
    ): Promise<DeleteResult> {
        return this.offerAccountLinkModel.deleteOne({offerId, influencerId, accountId}, {session});
    }

    // All links for the given offers (e.g., building public API connectedAccounts).
    async findByOfferIds(offerIds: Types.ObjectId[]): Promise<OfferAccountLink[]> {
        if (!offerIds.length) {
            return [];
        }
        return this.offerAccountLinkModel
            .find({offerId: {$in: offerIds}})
            .lean()
            .exec() as Promise<OfferAccountLink[]>;
    }

    // Links that exist for the viewport: offers × account rows.
    async findViewportLinks(params: {
        offerIds: Types.ObjectId[];
        accountPairs: OfferAccountPair[];
    }): Promise<OfferAccountLink[]> {
        const {offerIds, accountPairs} = params;
        if (!offerIds.length || !accountPairs.length) {
            return [];
        }
        const orClause = accountPairs.map((p) => ({
            influencerId: p.influencerId,
            accountId: p.accountId,
        }));
        return this.offerAccountLinkModel
            .find({
                offerId: {$in: offerIds},
                $or: orClause,
            })
            .lean()
            .exec() as Promise<OfferAccountLink[]>;
    }

    async countByOfferId(
        offerId: Types.ObjectId | string,
        session?: ClientSession,
    ): Promise<number> {
        return this.offerAccountLinkModel.countDocuments({
            offerId: new Types.ObjectId(offerId),
        }, {session});
    }
}
