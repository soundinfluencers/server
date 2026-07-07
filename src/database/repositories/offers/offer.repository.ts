import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseRepository } from '../base.repository';
import { Offer } from '../../schemas/offer/offer.schema';
import { InjectModel } from '@nestjs/mongoose';
import { DeleteResult, FilterQuery, Model, PipelineStage } from 'mongoose';
import { OfferAccountLink } from '../../schemas/offer/offer-account-link.schema';
import { Influencer, SocialAccount } from '../../schemas/users/influencer.schema';
import { ObjId } from '../../../common/types/base.types';
import {
  OfferFieldRecord,
  OffersMatrixAccountCursor,
  OffersMatrixOfferCursor,
  UpdateOfferFieldInput,
} from '../../../modules/admin/services/admin-offers.service';
import { SocialMediaEnum } from '../../../common/types/social-media.types';
import { OfferSocialMediaEnum } from 'src/common/types/offer.types';
import {
  CommunityMusicGenres,
  CreatorMusicGenres,
} from 'src/common/types/influencer/influencer.types';
import { FilteredNestLogger } from 'src/common/logger/filtered-nest-logger';

export type OfferHeaderRow = {
  offerId: ObjId;
  title: string;
  isPublished: boolean;
  offerPrice: number; // custom price
  costPrice: number; // auto-price - accounts' prices sum
  createdAt: Date;
};

export type OffersMatrixAccountRow = {
  influencerId: ObjId;
  accountId: ObjId;
  username: string;
  followers: number;
  publicPrice: number;
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
    socialMedia: OfferSocialMediaEnum;
    genre: string;
    take: number;
    cursor?: OffersMatrixOfferCursor | null;
  }): Promise<OfferHeaderRow[]>;

  // Get cursor paginated influencer account rows for the offers matrix (matrix rows)
  getOffersMatrixAccountRowsPage(params: {
    socialMedia: OfferSocialMediaEnum;
    genre: CommunityMusicGenres | CreatorMusicGenres;
    take: number;
    cursor?: OffersMatrixAccountCursor | null;
  }): Promise<OffersMatrixAccountRow[]>;
}

@Injectable()
export class OfferRepository extends BaseRepository<Offer> implements IOfferRepository {
  private readonly logger = new FilteredNestLogger(OfferRepository.name);

  constructor(
    @InjectModel(Offer.name) private readonly offerModel: Model<Offer>,
    @InjectModel(OfferAccountLink.name)
    private readonly offerAccountLinkModel: Model<OfferAccountLink>,
    @InjectModel(Influencer.name) private readonly influencerModel: Model<Influencer>,
  ) {
    super(offerModel);
  }

  async updatePublishedStatusMany(): Promise<void> {
    // Get first offer
    const firstOffer = await this.offerModel.findOne().select('isPublished').lean();

    // Opposite value of first offer
    const firstValue = firstOffer?.isPublished ?? false;

    // Update all offers' published status
    await this.offerModel.updateMany(
      {},
      {
        $set: { isPublished: !firstValue },
      },
    );
  }

  async updatePublishedStatusOne(offerId: string): Promise<void> {
    const offerObjectId = new ObjId(offerId);

    const result = await this.offerModel.updateOne({ _id: offerObjectId }, [
      {
        $set: {
          isPublished: { $not: '$isPublished' },
        },
      },
    ]);

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
    socialMedia: OfferSocialMediaEnum;
    genre: CommunityMusicGenres | CreatorMusicGenres;
    take: number;
    cursor?: OffersMatrixOfferCursor | null;
  }): Promise<OfferHeaderRow[]> {
    const { socialMedia, genre, take, cursor } = params;

    const filter: FilterQuery<Offer> = {
      socialMedia,
      genre,
    };

    if (cursor) {
      const cAt = new Date(cursor.createdAt);
      const oid = new ObjId(cursor.offerId);
      filter.$or = [
        { createdAt: { $lt: cAt } },
        { $and: [{ createdAt: cAt }, { _id: { $lt: oid } }] },
      ];
    }

    const rows = await this.offerModel
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(take + 1)
      .lean()
      .exec();

    // Set of unique accountIds
    const accountsCache = new Map<ObjId, SocialAccount>();
    // Filtered offers
    const processedOffers: OfferHeaderRow[] = [];

    for (const offer of rows) {
      const links: OfferAccountLink[] | null = await this.offerAccountLinkModel.find({
        offerId: offer._id,
      });

      if (!Array.isArray(links) || links.length <= 0) {
        processedOffers.push({
          offerId: offer._id as ObjId,
          title: offer.title,
          isPublished: offer.isPublished,
          offerPrice: offer.price,
          costPrice: 0,
          createdAt: offer.createdAt ?? new Date(0),
        })
        continue;
      }

      const offerSocialMedia = offer.socialMedia.split('_')[0];
      let costPrice = 0;

      for (const link of links) {
        if (!accountsCache.has(link.accountId)) {
          const influencer = await this.influencerModel.findOne({
            [`${offerSocialMedia}._id`]: link.accountId
          })

          // Deleting invalid offer account link
          if (!influencer) {
            this.logger.warn(`
              Didn't find influencer for offer, so deleting this offer link.\nOffer id: ${JSON.stringify(offer._id)}\nOffer link: ${JSON.stringify(link, null, '\t')}
            `);
            await this.offerAccountLinkModel.deleteOne({ _id: link._id });
            continue;
          }

          const socialAccount: SocialAccount | null =
            influencer[offerSocialMedia]?.find(
              (acc) => acc._id = link.accountId
            ) ?? null;

          // Deleting invalid offer account link
          if (!socialAccount) {
            this.logger.warn(`
              Didn't find social account for offer, so deleting this offer link.\nOffer id: ${JSON.stringify(offer._id)}\nOffer link: ${JSON.stringify(link, null, '\t')}
            `);
            await this.offerAccountLinkModel.deleteOne({ _id: link._id });
            continue;
          }

          costPrice += socialAccount.publicPrice;
          accountsCache.set(link.accountId, socialAccount);
        } else {
          const socialAccount = accountsCache.get(link.accountId);
          costPrice += socialAccount.publicPrice;
        }
      }

      processedOffers.push({
        offerId: offer._id as ObjId,
        title: offer.title,
        isPublished: offer.isPublished,
        offerPrice: offer.price,
        costPrice: costPrice,
        createdAt: offer.createdAt ?? new Date(0),
      });
    }

    return processedOffers;
  }

  async getOffersMatrixAccountRowsPage(params: {
    socialMedia: OfferSocialMediaEnum;
    genre: CommunityMusicGenres | CreatorMusicGenres;
    take: number;
    cursor?: OffersMatrixAccountCursor | null;
  }): Promise<OffersMatrixAccountRow[]> {
    const { socialMedia, genre, take, cursor } = params;

    const sm = String(socialMedia).replace(/_(creators|communities)$/, '');
    const genreField = String(socialMedia).endsWith('_creators')
      ? 'creatorMusicGenres'
      : 'communityMusicGenres';

    const pipeline: PipelineStage[] = [
      {
        $unwind: {
          path: `$${sm}`,
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          [`${sm}.isDeleted`]: { $ne: true },
          [`${sm}.isHidden`]: { $ne: true },
        },
      },
      {
        $match: {
          [`${sm}.${genreField}`]: genre,
        },
      },
      {
        $addFields: {
          sortUsername: {
            $toLower: {
              $ifNull: [`$${sm}.username`, ''],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          influencerId: '$_id',
          accountId: `$${sm}._id`,
          username: `$${sm}.username`,
          followers: `$${sm}.followers`,
          publicPrice: `$${sm}.publicPrice`,
          logoUrl: `$${sm}.logoUrl`,
          sortUsername: 1,
        },
      },
      {
        $sort: {
          sortUsername: 1,
          influencerId: 1,
          accountId: 1,
        },
      },
    ];

    if (cursor) {
      const infId = new ObjId(cursor.influencerId);
      const accId = new ObjId(cursor.accountId);

      pipeline.push({
        $match: {
          $or: [
            {
              sortUsername: { $gt: cursor.sortUsername },
            },
            {
              $and: [{ sortUsername: cursor.sortUsername }, { influencerId: { $gt: infId } }],
            },
            {
              $and: [
                { sortUsername: cursor.sortUsername },
                { influencerId: infId },
                { accountId: { $gt: accId } },
              ],
            },
          ],
        },
      });
    }

    pipeline.push({ $limit: take + 1 });

    return this.influencerModel.aggregate<OffersMatrixAccountRow>(pipeline);
  }

  async delete(offerId: string): Promise<DeleteResult | null> {
    const session = await this.offerModel.startSession();
    const offerObjectId = new ObjId(offerId);

    try {
      let result: DeleteResult | null = null;

      await session.withTransaction(async () => {
        // Delete all related offer account links
        await this.offerAccountLinkModel.deleteMany({ offerId: offerObjectId }, { session });

        // Delete offer
        result = await this.offerModel.deleteOne({ _id: offerObjectId }, { session });
      });

      return result;
    } finally {
      await session.endSession();
    }
  }
}
