import { HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { BaseRepository } from '../base.repository';
import { Offer } from '../../schemas/offer/offer.schema';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, DeleteResult, FilterQuery, Model, PipelineStage, UpdateResult } from 'mongoose';
import { OfferAccountLink } from '../../schemas/offer/offer-account-link.schema';
import { Influencer } from '../../schemas/users/influencer.schema';
import { ObjId } from '../../../common/types/base.types';
import {
  OffersMatrixAccountCursor,
  OffersMatrixOfferCursor,
} from '../../../modules/admin/services/admin-offers.service';
import {
  OfferFieldRecord,
  UpdateOfferFieldInput,
} from '../../../modules/admin/services/offers/update-offer-field.service';
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
  combinedFollowers: number;
  createdAt: Date;
  cursorOfferId: ObjId;
  cursorCombinedFollowers: number;
  cursorCreatedAt: Date;
};

export type OffersMatrixAccountRow = {
  influencerId: ObjId;
  accountId: ObjId;
  username: string;
  followers: number;
  publicPrice: number;
  pricePerFollower: number;
  logoUrl?: string;
  sortUsername: string;
};

// Interface for offer repository
interface IOfferRepository {
  // Changes isPublished status for offers with specified socialMedia and genre
  changePublishedStatuses(socialMedia: OfferSocialMediaEnum, genre: CommunityMusicGenres | CreatorMusicGenres): Promise<void>;

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

  async changePublishedStatuses(socialMedia: OfferSocialMediaEnum, genre: CommunityMusicGenres | CreatorMusicGenres): Promise<void> {
    // METHOD PIPELINE:
    //
    // 1. Start a Mongo transaction.
    // 2. Find all original offers for the given socialMedia + genre.
    //    Original offer = offer without referenceId.
    // 3. Find all unpublished working copies for these originals.
    //    Working copy = offer with referenceId pointing to an original offer.
    // 4. For each original offer:
    //    - If a working copy exists:
    //      a) delete links of the old original offer;
    //      b) delete the old original offer;
    //      c) promote the working copy:
    //         unset referenceId and set isPublished = true.
    //    - If no working copy exists:
    //      set original isPublished = true.
    // 5. Commit transaction.
    // 6. Roll back transaction on any error.


    // 1. Start a Mongo transaction.
    const session = await this.offerModel.startSession();
    session.startTransaction();

    try {
      // 2. Find all original offers for the given socialMedia + genre.
      //    Original offer = offer without referenceId.
      const originalOffers = await this.offerModel.find({
        socialMedia,
        genre,
        combinedFollowers: { "$gt": 0 },
        referenceId: null,
      }, null, { session });

      if (originalOffers?.length <= 0) {
        throw new NotFoundException("Offers for this genre were not found.");
      }

      const offersIds = originalOffers.map(offer => offer._id);

      // 3. Find all unpublished working copies for these originals.
      //    Working copy = offer with referenceId pointing to an original offer.
      const workingCopies = await this.offerModel.find({
        referenceId: { "$in": offersIds },
        socialMedia,
        genre,
        isPublished: false
      }, null, { session });


      // 4. For each original offer:
      //    - If a working copy exists:
      //      a) delete links of the old original offer;
      //      b) delete the old original offer;
      //      c) promote the working copy:
      //         unset referenceId and set isPublished = true.
      //    - If no working copy exists:
      //      set original isPublished = true.
      for (const original of originalOffers) {
        const workingCopy = workingCopies?.find((copy) => copy.referenceId.toString() === original._id.toString());

        if (!workingCopy) {
          const updateResult = await this.offerModel.updateOne(
            { _id: original._id },
            { $set: { isPublished: true } },
            { session }
          );

          if (updateResult.matchedCount === 0) {
            this.logger.warn(`
              Offer ${original.title} not found in update query. \nupdateResult info: ${JSON.stringify(updateResult, null, '\t')}
            `);
            throw new InternalServerErrorException(`Something went wrong with publishing ${original.title} offer.`);
          }

          // If offer was already pubished - modifiedCount is not an error
          if (original.isPublished === false && updateResult.modifiedCount === 0) {
            this.logger.warn(`
              Offer ${original.title}'s isPublished wasn't changed to "true". \nupdateResult info: ${JSON.stringify(updateResult, null, '\t')}
            `);
            throw new InternalServerErrorException(`Something went wrong with publishing ${original.title} offer.`);
          }

          continue;
        }

        // If a working copy exists:
        //    a) delete links of the old original offer;
        //      * DON'T CHECK DELETE COUNT IN RESULT, BECAUSE IT'S NORMAL BEHAVIOUR WHEN OFFER DOESN'T HAVE ANY LINK *
        await this.offerAccountLinkModel.deleteMany(
          { offerId: original._id },
          { session }
        );

        //    b) delete the old original offer;
        const deleteOriginalResult = await this.offerModel.deleteOne({ _id: original._id }, { session });

        if (deleteOriginalResult.acknowledged === false) {
          this.logger.warn(`
              Original offer ${original.title} not found in deleteOne query. \ndeleteOriginalResult info: ${JSON.stringify(deleteOriginalResult, null, '\t')}
            `);
          throw new InternalServerErrorException(`Something went wrong with publishing ${original.title} offer.`);
        }
        if (deleteOriginalResult.deletedCount !== 1) {
          this.logger.warn(`
              Original offer ${original.title} wasn't deleted. \ndeleteOriginalResult info: ${JSON.stringify(deleteOriginalResult, null, '\t')}
            `);
          throw new InternalServerErrorException(`Something went wrong with publishing ${original.title} offer.`);
        }

        //    c) promote the working copy:
        //        unset referenceId and set isPublished = true.
        const promoteCopyResult = await this.updateOne(
          {
            _id: workingCopy._id
          },
          {
            $set: {
              isPublished: true,
            },
            $unset: {
              referenceId: 1
            }
          },
          { session }
        );

        if (promoteCopyResult.matchedCount === 0) {
          this.logger.warn(`
              Offer ${original.title} not found in update query while trying to promote a ${workingCopy._id.toString()} working copy. \npromoteCopyResult info: ${JSON.stringify(promoteCopyResult, null, '\t')}
            `);
          throw new InternalServerErrorException(`Something went wrong with publishing ${original.title} offer.`);
        }
        if (promoteCopyResult.modifiedCount === 0) {
          this.logger.warn(`
              Offer ${original.title}'s isPublished wasn't changed to "true" while trying to promote a ${workingCopy._id.toString()} working copy. \npromoteCopyResult info: ${JSON.stringify(promoteCopyResult, null, '\t')}
            `);
          throw new InternalServerErrorException(`Something went wrong with publishing ${original.title} offer.`);
        }
      }

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      if (!(err instanceof HttpException)) {
        this.logger.error(`Error while trying to publish ${socialMedia} - ${genre} offers`, err instanceof Error ? err.stack : String(err));
      }
      throw err;
    } finally {
      await session.endSession();
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
    const offerSocialMedia = socialMedia.split('_')[0];

    const filter: FilterQuery<Offer> = {
      socialMedia,
      genre,
      referenceId: { $exists: false },
    };

    if (cursor) {
      const cAt = new Date(cursor.createdAt);
      const oid = new ObjId(cursor.offerId);
      const combinedFollowers = cursor.combinedFollowers;
      filter.$or = [
        { combinedFollowers: { $gt: combinedFollowers } },
        { $and: [{ combinedFollowers }, { createdAt: { $lt: cAt } }] },
        { $and: [{ combinedFollowers }, { createdAt: cAt }, { _id: { $lt: oid } }] },
      ];
    }

    const rows = await this.offerModel
      .find(filter)
      .sort({ combinedFollowers: 1, createdAt: -1, _id: -1 })
      .limit(take + 1)
      .lean()
      .exec();

    if (!rows.length) {
      return [];
    }

    // 1. Подгружаю офферы
    // 2. Для каждого оффера проверяю:
    //    -- Если он опубликован, то пробую найти рабочую копию. Дальше два варианта:
    //        Если копии нет, то отображаю оригинал.
    //        Если копия есть, заменяю оригинал на неё
    //    -- Проверяю, является ли этот оффер рабочей копией. Если да, то перехожу к обработке следующего. 

    const publishedBaseOfferIds = rows
      .filter((offer) => offer.isPublished === true)
      .map((offer) => offer._id);

    const workingCopies = publishedBaseOfferIds.length
      ? await this.offerModel
        .find({
          referenceId: { $in: publishedBaseOfferIds },
          socialMedia,
          genre,
          isPublished: false,
        })
        .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
        .lean()
        .exec()
      : [];

    const workingCopyByOriginalOfferId = new Map<string, Offer>();

    for (const copy of workingCopies) {
      const referenceId = copy.referenceId?.toString();

      if (referenceId && !workingCopyByOriginalOfferId.has(referenceId)) {
        workingCopyByOriginalOfferId.set(referenceId, copy as Offer);
      }
    }

    const effectiveRows = rows.map((baseOffer) => {
      const workingCopy = baseOffer.isPublished === true
        ? workingCopyByOriginalOfferId.get(baseOffer._id.toString())
        : undefined;

      return {
        baseOffer,
        offer: workingCopy ?? baseOffer,
      };
    });

    const effectiveOfferIds = effectiveRows.map(({ offer }) => offer._id);

    // Getting all links
    const links = await this.offerAccountLinkModel.find({
      offerId: { $in: effectiveOfferIds }
    }).lean();

    // If there's no links - return offers headers with costPrice equal to zero
    if (!Array.isArray(links) || links.length <= 0) {
      return effectiveRows.map(({ baseOffer, offer }) => ({
        offerId: offer._id as ObjId,
        title: offer.title,
        isPublished: offer.isPublished,
        offerPrice: offer.price,
        costPrice: 0,
        combinedFollowers: 0,
        createdAt: offer.createdAt ?? new Date(0),
        cursorOfferId: baseOffer._id as ObjId,
        cursorCombinedFollowers: baseOffer.combinedFollowers ?? 0,
        cursorCreatedAt: baseOffer.createdAt ?? new Date(0),
      }));
    }

    const linksByOfferId = new Map<string, OfferAccountLink[]>(); // grouped links 
    const uniqueInfluencerIds = new Set<string>(); // unique influencers' ids for fetching all data in one request

    for (const link of links) {
      if (linksByOfferId.has(link.offerId.toString())) {
        const currentArray = linksByOfferId.get(link.offerId.toString());
        currentArray.push(link);
        linksByOfferId.set(link.offerId.toString(), currentArray);
      } else {
        linksByOfferId.set(link.offerId.toString(), [link]);
      }

      uniqueInfluencerIds.add(link.influencerId.toString());
    }

    // Fetching all needed influencers data
    const influencers = await this.influencerModel.find(
      {
        _id: { $in: Array.from(uniqueInfluencerIds).map((id) => new ObjId(id)) },
      }
    ).select(offerSocialMedia).lean();

    // If there's no influencers - return offers headers with costPrice equal to zero
    if (!Array.isArray(influencers) || influencers.length <= 0) {
      return effectiveRows.map(({ baseOffer, offer }) => ({
        offerId: offer._id as ObjId,
        title: offer.title,
        isPublished: offer.isPublished,
        offerPrice: offer.price,
        costPrice: 0,
        combinedFollowers: 0,
        createdAt: offer.createdAt ?? new Date(0),
        cursorOfferId: baseOffer._id as ObjId,
        cursorCombinedFollowers: baseOffer.combinedFollowers ?? 0,
        cursorCreatedAt: baseOffer.createdAt ?? new Date(0),
      }));
    }

    // Map for with account and price
    //
    // Key - influencerId:accountId
    // Value - account.publicPrice
    const accountPriceMap = new Map<string, number>();
    const accountFollowersMap = new Map<string, number>();

    for (const influencer of influencers) {
      for (const account of influencer[offerSocialMedia]) {
        const key = `${influencer._id.toString()}:${account._id.toString()}`;
        accountPriceMap.set(key, account.publicPrice);
        accountFollowersMap.set(key, account.followers);
      }
    }

    const processedOffers: OfferHeaderRow[] = [];

    for (const { baseOffer, offer } of effectiveRows) {
      let costPrice = 0;
      let combinedFollowers = 0;

      const offerLinks: OfferAccountLink[] = linksByOfferId.get(offer._id.toString());

      if (Array.isArray(offerLinks) && offerLinks.length !== 0) {
        for (const link of offerLinks) {
          const key = `${link.influencerId.toString()}:${link.accountId.toString()}`;
          const price = accountPriceMap.get(key);
          const followers = accountFollowersMap.get(key);

          if (price) {
            costPrice += price;
          }

          if (followers) {
            combinedFollowers += followers;
          }
        }
      }

      processedOffers.push({
        offerId: offer._id as ObjId,
        title: offer.title,
        isPublished: offer.isPublished,
        offerPrice: offer.price,
        costPrice: costPrice,
        combinedFollowers,
        createdAt: offer.createdAt ?? new Date(0),
        cursorOfferId: baseOffer._id as ObjId,
        cursorCombinedFollowers: baseOffer.combinedFollowers ?? 0,
        cursorCreatedAt: baseOffer.createdAt ?? new Date(0),
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
          pricePerFollower: {
            $cond: [
              { $gt: [`$${sm}.followers`, 0] },
              {
                $round: [
                  {
                    $divide: [
                      { $ifNull: [`$${sm}.publicPrice`, 0] },
                      `$${sm}.followers`,
                    ],
                  },
                  8,
                ],
              },
              0,
            ],
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
          pricePerFollower: 1,
          logoUrl: `$${sm}.logoUrl`,
          sortUsername: 1,
        },
      },
      {
        $sort: {
          pricePerFollower: 1,
          sortUsername: 1,
          influencerId: 1,
          accountId: 1,
        },
      },
    ];

    if (cursor) {
      const infId = new ObjId(cursor.influencerId);
      const accId = new ObjId(cursor.accountId);
      const cursorPricePerFollower = await this.getAccountPricePerFollower({
        sm,
        influencerId: infId,
        accountId: accId,
      });

      if (cursorPricePerFollower === null) {
        return [];
      }

      pipeline.push({
        $match: {
          $or: [
            {
              pricePerFollower: { $gt: cursorPricePerFollower },
            },
            {
              $and: [
                { pricePerFollower: cursorPricePerFollower },
                { sortUsername: { $gt: cursor.sortUsername } },
              ],
            },
            {
              $and: [
                { pricePerFollower: cursorPricePerFollower },
                { sortUsername: cursor.sortUsername },
                { influencerId: { $gt: infId } },
              ],
            },
            {
              $and: [
                { pricePerFollower: cursorPricePerFollower },
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

  private async getAccountPricePerFollower(params: {
    sm: string;
    influencerId: ObjId;
    accountId: ObjId;
  }): Promise<number | null> {
    const { sm, influencerId, accountId } = params;
    const [row] = await this.influencerModel.aggregate<{ pricePerFollower: number }>([
      {
        $match: {
          _id: influencerId,
        },
      },
      {
        $unwind: {
          path: `$${sm}`,
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          [`${sm}._id`]: accountId,
        },
      },
      {
        $project: {
          _id: 0,
          pricePerFollower: {
            $cond: [
              { $gt: [`$${sm}.followers`, 0] },
              {
                $round: [
                  {
                    $divide: [
                      { $ifNull: [`$${sm}.publicPrice`, 0] },
                      `$${sm}.followers`,
                    ],
                  },
                  8,
                ],
              },
              0,
            ],
          },
        },
      },
      {
        $limit: 1,
      },
    ]);

    return row?.pricePerFollower ?? null;
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

  // Counts combinedFollowers for specified offer (finds all links by offerId)
  async findOfferAndCountFollowers(offerId: ObjId, session?: ClientSession): Promise<{ offer: Offer, combinedFollowers: number }> {
    let combinedFollowers = 0;

    const offer = await this.offerModel.findById(offerId).session(session);

    if (!offer || !offer.socialMedia) {
      this.logger.warn(`Didn't find offer ${offerId}`);
      return null;
    }
    const socialMedia = offer.socialMedia.split('_')[0];

    // Getting all links
    const links = await this.offerAccountLinkModel.find({ offerId }).lean().session(session);

    // If there's no links - return 0
    if (!Array.isArray(links) || links.length <= 0) {
      // No warning log, because it's a normal scenario when offer doesn't have any connected account yet
      return {
        offer,
        combinedFollowers: 0
      };
    }

    const uniqueInfluencerIds = new Set<ObjId>(); // unique influencers' ids for fetching all data in one request

    for (const link of links) {
      if (!uniqueInfluencerIds.has(link.influencerId)) {
        uniqueInfluencerIds.add(link.influencerId);
      }
    }

    // Fetching all needed influencers data
    const influencers = await this.influencerModel.find(
      {
        _id: { $in: Array.from(uniqueInfluencerIds) },
      }
    ).select(socialMedia).lean().session(session);

    // If there's no influencers - return 0
    if (!Array.isArray(influencers) || influencers.length <= 0) {
      this.logger.warn(`Didn't find any influncer in influencers collection while fetching offer ${offerId}`);
      return null;
    }

    // Map for with account and price
    //
    // Key - influencerId:accountId
    // Value - account.followers
    const accountFollowersMap = new Map<string, number>();

    for (const influencer of influencers) {
      for (const account of influencer[socialMedia]) {
        accountFollowersMap.set(`${influencer._id.toString()}:${account._id.toString()}`, account.followers);
      }
    }

    for (const link of links) {
      const key = `${link.influencerId.toString()}:${link.accountId.toString()}`;
      const followers = accountFollowersMap.get(key);

      if (!followers) {
        continue;
      }

      combinedFollowers += followers;
    }

    return {
      offer,
      combinedFollowers
    };
  }
}
