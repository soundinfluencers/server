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
  changePublishedStatuses(socialMedia: OfferSocialMediaEnum, genre: CommunityMusicGenres | CreatorMusicGenres);

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

  async changePublishedStatuses(socialMedia: OfferSocialMediaEnum, genre: CommunityMusicGenres | CreatorMusicGenres) {
    const filter: FilterQuery<Offer> = {
      socialMedia,
      genre,
      combinedFollowers: { "$gt": 0 }
    } 
    
    const firstSortedOffer = await this.offerModel
      .findOne(filter)
      .sort({
        combinedFollowers: 1,
        createdAt: -1,
        _id: -1,
      })
      .select('isPublished')
      .lean()
      .exec();

    const isPublished = firstSortedOffer.isPublished;

    const updateResult = await this.offerModel.updateMany(
      filter,
      {
        $set: { isPublished: !isPublished }
      },
    );

    return updateResult;
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
    const offerSocialMedia = socialMedia.split('_')[0];

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
      .sort({ combinedFollowers: 1, createdAt: -1, _id: -1 })
      .limit(take + 1)
      .lean()
      .exec();

    // Filtered offers
    const processedOffers: OfferHeaderRow[] = [];

    const offerIds = rows.map(off => off._id);

    // Getting all links
    const links = await this.offerAccountLinkModel.find({
      offerId: { $in: offerIds }
    }).lean();

    // If there's no links - return offers headers with costPrice equal to zero
    if (!Array.isArray(links) || links.length <= 0) {
      return rows.map(offer => ({
        offerId: offer._id as ObjId,
        title: offer.title,
        isPublished: offer.isPublished,
        offerPrice: offer.price,
        costPrice: 0,
        createdAt: offer.createdAt ?? new Date(0),
      }));
    }

    const linksByOfferId = new Map<string, OfferAccountLink[]>(); // grouped links 
    const uniqueInfluencerIds = new Set<ObjId>(); // unique influencers' ids for fetching all data in one request

    for (const link of links) {
      if (linksByOfferId.has(link.offerId.toString())) {
        const currentArray = linksByOfferId.get(link.offerId.toString());
        currentArray.push(link);
        linksByOfferId.set(link.offerId.toString(), currentArray);
      } else {
        linksByOfferId.set(link.offerId.toString(), [link]);
      }

      if (!uniqueInfluencerIds.has(link.influencerId)) {
        uniqueInfluencerIds.add(link.influencerId);
      }
    }

    // Fetching all needed influencers data
    const influencers = await this.influencerModel.find(
      {
        _id: { $in: Array.from(uniqueInfluencerIds) },
      }
    ).select(offerSocialMedia).lean();

    // If there's no influencers - return offers headers with costPrice equal to zero
    if (!Array.isArray(influencers) || influencers.length <= 0) {
      return rows.map(offer => ({
        offerId: offer._id as ObjId,
        title: offer.title,
        isPublished: offer.isPublished,
        offerPrice: offer.price,
        costPrice: 0,
        createdAt: offer.createdAt ?? new Date(0),
      }));
    }

    // Map for with account and price
    //
    // Key - influencerId:accountId
    // Value - account.publicPrice
    const accountPriceMap = new Map<string, number>();

    for (const influencer of influencers) {
      for (const account of influencer[offerSocialMedia]) {
        accountPriceMap.set(`${influencer._id.toString()}:${account._id.toString()}`, account.publicPrice);
      }
    }

    for (const offer of rows) {
      let costPrice = 0;

      const offerLinks: OfferAccountLink[] = linksByOfferId.get(offer._id.toString());

      if (Array.isArray(offerLinks) && offerLinks.length !== 0) {
        for (const link of offerLinks) {
          const key = `${link.influencerId.toString()}:${link.accountId.toString()}`;
          const price = accountPriceMap.get(key);

          if (!price) {
            continue;
          }

          costPrice += price;
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
