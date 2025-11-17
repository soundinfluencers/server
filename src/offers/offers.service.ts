import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Influencer } from '../auth/schemas/influencer.schema';
import { OfferDto } from './dto/offer.dto';
import { SocialMediaEnum, SocialMediaType } from '../types/social-media.types';
import { ChangeOfferDeletedStatusDto } from './dto/change-offer-deleted-status.dto';
import { allowedGenresMap } from '../types/genres.types';
import { OfferConnectedAccount } from './entities/offer-connected-account.entity';
import { Offer } from './schemas/offer.schema';

@Injectable()
export class OffersService {
  private readonly logger = new Logger();

  constructor(
    @InjectModel(Offer.name) private offersModel: Model<Offer>,
    @InjectModel(Influencer.name) private readonly influencerModel: Model<Influencer>,
  ) {}

  async createOffer(offer: Offer) {
    try {
      const newOffer = await this.offersModel.create(offer);
      return {
        code: 201,
        data: newOffer,
        message: `Offer created: ${newOffer._id}`,
      };
    } catch (err) {
      this.logger.error(
        `Can't create offer ${offer.title}: ${err}`,
        err instanceof Error ? err.stack : new Error().stack,
      );
      return {
        code: 500,
        message: 'Internal Server Error',
        error: err,
      };
    }
  }

  async getPublishedOffersByGenreAndSocialMedia(
    socialMedia: SocialMediaType,
    genre: string,
  ): Promise<{
    code: number;
    message: string;
    offers: Offer[] | null;
  }> {
    try {
      const offers = await this.offersModel
        .find({ socialMedia, genre, isPublished: true, isDeleted: false })
        .lean()
        .exec();

      if (!offers?.length) {
        return {
          code: 204,
          message: "There's no offers",
          offers: [],
        };
      }

      // Уникальные пары influencerId и accountId
      const accountIdsMap = new Map<string, Set<string>>();
      offers.forEach((offer) => {
        offer.connectedAccounts.forEach((account) => {
          const influencerIdStr = account.influencerId.toString();
          const accountIdStr = account.accountId.toString();
          if (!accountIdsMap.has(influencerIdStr)) {
            accountIdsMap.set(influencerIdStr, new Set());
          }
          accountIdsMap.get(influencerIdStr)!.add(accountIdStr);
        });
      });

      // Генерация массива пар
      const pairs = Array.from(accountIdsMap.entries()).flatMap(([influencerId, accountIds]) =>
        Array.from(accountIds).map((accountId) => `${influencerId}_${accountId}`),
      );

      // Агрегация инфлюенсеров и извлекание только ника и логотипа для нужных аккаунтов
      const influencers = await this.influencerModel
        .aggregate([
          {
            $match: {
              _id: {
                $in: Array.from(accountIdsMap.keys()).map((id) => new Types.ObjectId(id)),
              },
            },
          },
          {
            $unwind: {
              path: `$${socialMedia}`,
              preserveNullAndEmptyArrays: false,
            },
          },
          {
            $addFields: {
              pairKey: {
                $concat: [{ $toString: '$_id' }, '_', { $toString: `$${socialMedia}._id` }],
              },
            },
          },
          {
            $match: {
              pairKey: { $in: pairs },
            },
          },
          {
            $project: {
              _id: 1,
              socialMediaUsername: `$${socialMedia}.instagramUsername`,
              logo: `$${socialMedia}.logo`,
              accountId: `$${socialMedia}._id`,
            },
          },
        ])
        .exec();

      // Map для быстрого доступа к socialMediaUsername и logos
      const accountMap = new Map<string, { socialMediaUsername: string; logo: string }>();
      influencers.forEach((influencer) => {
        if (influencer.accountId) {
          accountMap.set(`${influencer._id.toString()}:${influencer.accountId.toString()}`, {
            socialMediaUsername: influencer.socialMediaUsername,
            logo: influencer.logo,
          });
        }
      });

      // Обновление connectedAccounts в оферах
      const updatedOffers = offers.map((offer) => ({
        ...offer,
        connectedAccounts: offer.connectedAccounts
          .map((account) => {
            const accountData = accountMap.get(
              `${account.influencerId.toString()}:${account.accountId.toString()}`,
            );

            if (!accountData) return null;

            return {
              ...account,
              socialMediaUsername: accountData.socialMediaUsername,
              logo: accountData.logo,
            };
          })
          .filter((acc) => acc !== null),
      }));

      return {
        code: 200,
        message: 'Successfully found offers',
        offers: updatedOffers,
      };
    } catch (err) {
      this.logger.error(
        `Can't get offers with social media: ${socialMedia} and genre: ${genre}: \n${err}`,
        err instanceof Error ? err.stack : new Error().stack,
      );
      return {
        code: 500,
        message: `Can't get offers with social media: ${socialMedia} and genre: ${genre}: ${err}`,
        offers: null,
      };
    }
  }

  async getAllOffersByGenreAndSocialMedia(
    socialMedia: SocialMediaType,
    genre: string,
  ): Promise<{
    code: number;
    message: string;
    offers: Offer[] | null;
  }> {
    try {
      const offers = await this.offersModel.find({ socialMedia, genre }).lean().exec();

      if (!offers?.length) {
        return {
          code: 204,
          message: "There's no offers",
          offers: [],
        };
      }

      // Уникальные пары influencerId и accountId
      const accountIdsMap = new Map<string, Set<string>>();
      offers.forEach((offer) => {
        offer.connectedAccounts.forEach((account) => {
          const influencerIdStr = account.influencerId.toString();
          const accountIdStr = account.accountId.toString();
          if (!accountIdsMap.has(influencerIdStr)) {
            accountIdsMap.set(influencerIdStr, new Set());
          }
          accountIdsMap.get(influencerIdStr)!.add(accountIdStr);
        });
      });

      // Генерация массива пар
      const pairs = Array.from(accountIdsMap.entries()).flatMap(([influencerId, accountIds]) =>
        Array.from(accountIds).map((accountId) => `${influencerId}_${accountId}`),
      );

      // Агрегация инфлюенсеров и извлекание только ника и логотипа для нужных аккаунтов
      const influencers = await this.influencerModel
        .aggregate([
          {
            $match: {
              _id: {
                $in: Array.from(accountIdsMap.keys()).map((id) => new Types.ObjectId(id)),
              },
            },
          },
          {
            $unwind: {
              path: `$${socialMedia}`,
              preserveNullAndEmptyArrays: false,
            },
          },
          {
            $addFields: {
              pairKey: {
                $concat: [{ $toString: '$_id' }, '_', { $toString: `$${socialMedia}._id` }],
              },
            },
          },
          {
            $match: {
              pairKey: { $in: pairs },
            },
          },
          {
            $project: {
              _id: 1,
              socialMediaUsername: `$${socialMedia}.instagramUsername`,
              logo: `$${socialMedia}.logo`,
              accountId: `$${socialMedia}._id`,
            },
          },
        ])
        .exec();

      // Map для быстрого доступа к socialMediaUsername и logos
      const accountMap = new Map<string, { socialMediaUsername: string; logo: string }>();
      influencers.forEach((influencer) => {
        if (influencer.accountId) {
          accountMap.set(`${influencer._id.toString()}:${influencer.accountId.toString()}`, {
            socialMediaUsername: influencer.socialMediaUsername,
            logo: influencer.logo,
          });
        }
      });

      // Обновление connectedAccounts в оферах
      const updatedOffers = offers.map((offer) => ({
        ...offer,
        connectedAccounts: offer.connectedAccounts.map((account) => {
          const accountData = accountMap.get(
            `${account.influencerId.toString()}:${account.accountId.toString()}`,
          );

          return {
            ...account,
            socialMediaUsername: accountData?.socialMediaUsername,
            logo: accountData?.logo,
          };
        }),
      }));

      return {
        code: 200,
        message: 'Successfully found offers',
        offers: updatedOffers,
      };
    } catch (err) {
      this.logger.error(
        `Can't get offers with social media: ${socialMedia} and genre: ${genre}: \n${err}`,
        err instanceof Error ? err.stack : new Error().stack,
      );
      return {
        code: 500,
        message: `Can't get offers with social media: ${socialMedia} and genre: ${genre}: ${err}`,
        offers: null,
      };
    }
  }

  async importXlsxOffers(data: OfferDto[]): Promise<{
    code: number;
    createdCount: number;
    failedCount: number;
    created: { title: string }[];
    failed: { title: string; index: number; error: string }[];
  }> {
    try {
      if (data.every((item) => item.socialMedia !== 'press' && !item.genre)) {
        return {
          code: 404,
          createdCount: 0,
          failedCount: 1,
          created: [],
          failed: [
            {
              title: 'Invalid social media',
              index: 0,
              error: 'Only press offers can be created without social media!',
            },
          ],
        };
      }

      // Проверка на одинаковую соц сеть
      const socialMedia = data[0]?.socialMedia;
      if (!socialMedia || data.some((dto) => dto.socialMedia !== socialMedia)) {
        return {
          code: 404,
          createdCount: 0,
          failedCount: 1,
          created: [],
          failed: [
            {
              title: 'Different social media',
              index: 0,
              error: 'All offers must have the same social media type',
            },
          ],
        };
      }

      // Мап юзернеймов, дабы в будущем не тратить времени на уже найденные
      const allUsernames = new Set<string>();
      data.forEach((offerDto) => {
        offerDto.connectedAccounts.forEach((username) => allUsernames.add(username.trim()));
      });

      // Выполнение запроса ко всем уникальным usernames
      const influencers = await this.influencerModel
        .aggregate([
          {
            $project: {
              _id: 1,
              [socialMedia]: {
                $map: {
                  input: `$${socialMedia}`,
                  as: 'account',
                  in: {
                    $mergeObjects: [
                      '$$account',
                      {
                        instagramUsername: { $trim: { input: '$$account.instagramUsername' } },
                        _id: '$$account._id',
                      },
                    ],
                  },
                },
              },
            },
          },
          {
            $match: {
              [socialMedia]: {
                $elemMatch: {
                  instagramUsername: { $in: Array.from(allUsernames) },
                },
              },
            },
          },
        ])
        .exec();

      // Маппинг username -> influencerId
      const usernameToInfluencerId = new Map<
        string,
        { influencerId: Types.ObjectId; accountId: Types.ObjectId }
      >();
      influencers.forEach((influencer) => {
        const socialMediaField = influencer[socialMedia];
        if (socialMediaField) {
          socialMediaField.forEach((account) => {
            if (account.instagramUsername) {
              usernameToInfluencerId.set(account.instagramUsername, {
                influencerId: influencer._id,
                accountId: account._id,
              });
            }
          });
        }
      });

      const created: { title: string }[] = [];
      const failed: { title: string; index: number; error: string }[] = [];

      // Обработка каждого offerDto
      const resultsOfCreatingOffers = await Promise.allSettled(
          data.map(async (offerDto: OfferDto, index: number) => {
            const connectedAccounts = offerDto.connectedAccounts
                .map((username) => {
                  const influencerData = usernameToInfluencerId.get(username);
                  if (!influencerData) {
                    failed.push({
                      title: offerDto.title,
                      index,
                      error: `Can't find influencer with username "${username}"`,
                    });
                    this.logger.warn(
                        `Offer ${offerDto.title}: Can't find influencer with username "${username}"`,
                    );
                    return null;
                  }
                  
                  if (!influencerData.accountId || !influencerData.influencerId) {
                    this.logger.warn(
                        `Offer ${offerDto.title}: incomplete influencer data for "${username}"`,
                    );
                    failed.push({
                      title: offerDto.title,
                      index,
                      error: `Incomplete influencer data for username "${username}"`,
                    });
                    return null;
                  }
                  return {
                    _id: new Types.ObjectId(),
                    accountId: influencerData.accountId,
                    influencerId: influencerData.influencerId,
                  };
                })
                .filter((acc): acc is { _id: Types.ObjectId; accountId: Types.ObjectId; influencerId: Types.ObjectId } => !!acc);

            if (!connectedAccounts.length) {
              failed.push({
                title: offerDto.title,
                index,
                error: `No valid connected accounts found`,
              });
              this.logger.warn(
                  `Offer ${offerDto.title}: skipped — no valid connected accounts`,
              );
              return;
            }

            const offer: Offer = {
              title: this.replaceFollowersInTitle(offerDto.title),
              socialMedia: offerDto.socialMedia,
              connectedAccounts,
              price: offerDto.price,
              genre: offerDto.genre,
              combinedFollowers:
                  offerDto.socialMedia !== 'press'
                      ? this.getFollowersNumberPart(offerDto.title)
                      : null,
              networksAmount: connectedAccounts.length,
              storyAndPostDetails: offerDto.storyAndPostDetails,
              isPublished: false,
              isDeleted: false,
              _id: new Types.ObjectId(),
            };

            return await this.createOffer(offer);
          }),
      );

      resultsOfCreatingOffers.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          created.push({ title: data[index].title });
        } else {
          failed.push({ title: data[index].title, index, error: result.reason.message });
        }
      });

      return {
        code: 207,
        createdCount: created.length,
        failedCount: failed.length,
        created,
        failed,
      };
    } catch (err) {
      this.logger.error(
        `Error importing offers: ${err}`,
        err instanceof Error ? err.stack : new Error().stack,
      );
      return {
        code: 207,
        createdCount: 0,
        failedCount: 1,
        created: [],
        failed: [
          {
            title: 'Error',
            index: 0,
            error: 'Internal Server Error',
          },
        ],
      };
    }
  }

  async changeOfferDeletedStatus(data: ChangeOfferDeletedStatusDto) {
    try {
      const result = await this.offersModel.updateOne(
        { _id: new Types.ObjectId(data.offerId) },
        { $set: { isDeleted: data.newStatus, isPublished: false } },
      );

      if (result.matchedCount === 0) {
        return {
          code: 404,
          message: 'Offer not found',
        };
      }

      return {
        code: 200,
        message:
          result.modifiedCount > 0
            ? 'Offer deletion status updated'
            : 'Offer deletion status unchanged (was already this value)',
      };
    } catch (err) {
      this.logger.error(
        `Error changing ${data.offerId} offer 'isDeleted' status to "${data.newStatus}": ${err}`,
        err instanceof Error ? err.stack : new Error().stack,
      );
      return {
        code: 500,
        message: 'Internal server error',
      };
    }
  }

  async deleteOfferPermanently(offerId: string) {
    try {
      const result = await this.offersModel.deleteOne({
        _id: new Types.ObjectId(offerId),
      });

      if (result.deletedCount === 0) {
        return {
          code: 404,
          message: 'Offer not found',
        };
      }

      return {
        code: 200,
        message: 'Offer permanently deleted',
      };
    } catch (err) {
      this.logger.error(
        `Error deleting Offer ${offerId}: ${err}`,
        err instanceof Error ? err.stack : new Error().stack,
      );
      return {
        code: 500,
        message: 'Internal server error',
      };
    }
  }

  async publishAllOffers() {
    try {
      const result = await this.offersModel.updateMany(
        { isDeleted: false },
        { $set: { isPublished: true } },
      );

      if (result.matchedCount === 0) {
        return {
          code: 404,
          message: 'Offers not found',
        };
      }

      return {
        code: 200,
        message:
          result.modifiedCount > 0
            ? `Offers published (${result.modifiedCount} offers)`
            : 'Offer publish status unchanged (was already this value)',
      };
    } catch (err) {
      this.logger.error(
        `Error publishing all offers: ${err}`,
        err instanceof Error ? err.stack : new Error().stack,
      );
      return {
        code: 500,
        message: 'Internal server error',
      };
    }
  }

  async findAndReplaceOffer(offerObj: Offer) {
    try {
      const newOffer = await this.offersModel.findOneAndReplace({ _id: offerObj._id }, offerObj, {
        new: true,
      });

      if (!newOffer) {
        return {
          code: 404,
          message: 'Offer not found',
        };
      }

      return {
        code: 200,
        data: newOffer,
        message: `Offer updated: ${newOffer._id}`,
      };
    } catch (err) {
      this.logger.error(
        `Can't update offer ${offerObj.title}: ${err}`,
        err instanceof Error ? err.stack : new Error().stack,
      );
      return {
        code: 500,
        message: 'Internal Server Error',
        error: err,
      };
    }
  }

  //метод для приведения оффера к типу OfferRemake
  async formatOfferBeforeSaving(data: any, id: Types.ObjectId): Promise<Offer> {
    try {
      const { title, socialMedia, connectedAccounts, price, genre, storyAndPostDetails } = data;

      if (!title || !socialMedia || !connectedAccounts || !price) {
        throw new Error('Invalid data');
      }

      const allowedSocialMedia = Object.values(SocialMediaEnum);

      if (!allowedSocialMedia.includes(socialMedia as SocialMediaEnum)) {
        throw new Error(`Invalid social media - ${socialMedia}`);
      }

      const allowedGenres = allowedGenresMap[socialMedia as SocialMediaEnum];

      if (!allowedGenres) {
        throw new Error(`No genres configured for social media - ${socialMedia}`);
      }

      if (!allowedGenres.includes(genre)) {
        throw new Error(`Invalid genre "${genre}" for social media "${socialMedia}"`);
      }

      const offerPrice = parseInt(price);

      if (typeof offerPrice !== 'number') {
        throw new Error(`Price must be a number. At this point price is ${typeof price}`);
      }

      const results = await Promise.allSettled(
        connectedAccounts.map((acc: any) =>
          this.tryParseOfferConnectedAccount(acc, socialMedia as SocialMediaType),
        ),
      );

      const fulfilledResults = results.filter(
        (r): r is PromiseFulfilledResult<OfferConnectedAccount | null> => r.status === 'fulfilled',
      );

      const validConnectedAccounts: OfferConnectedAccount[] = fulfilledResults
        .map((r) => r.value)
        .filter((acc): acc is OfferConnectedAccount => acc !== null);

      return {
        title: this.replaceFollowersInTitle(title.trim()),
        socialMedia: socialMedia as SocialMediaType,
        connectedAccounts: validConnectedAccounts,
        price,
        genre,
        combinedFollowers: socialMedia !== 'press' ? this.getFollowersNumberPart(title) : null,
        networksAmount: validConnectedAccounts.length || null,
        storyAndPostDetails,
        isPublished: false,
        isDeleted: false,
        _id: id,
      };
    } catch (err) {
      throw new Error(err.message);
    }
  }

  async tryParseOfferConnectedAccount(
    account: any,
    socialMedia: SocialMediaType,
  ): Promise<OfferConnectedAccount | null> {
    try {
      if (!account?.influencerId || !account?.socialMediaUsername) return null;

      const influencerId = Types.ObjectId.isValid(account.influencerId)
        ? new Types.ObjectId(account.influencerId)
        : null;

      if (!influencerId) return null;

      const influencer = await this.influencerModel.findOne({ _id: influencerId });

      if (!influencer) return null;

      const socialAccounts: any = influencer[socialMedia];

      if (!Array.isArray(socialAccounts)) return null;

      const matchedAccount = socialAccounts.find(
        (acc) => acc.instagramUsername === account.socialMediaUsername,
      );

      if (!matchedAccount) return null;

      return {
        _id: new Types.ObjectId(),
        influencerId,
        accountId: new Types.ObjectId(matchedAccount._id),
      };
    } catch (err) {
      console.error('Error parsing offer connected account:', err);
      return null;
    }
  }

  getFollowersNumberPart = (title: string): string => {
    const match = title.match(/\b(\d+(\.\d+)?)([KM])\b/i);
    if (!match) {
      throw new Error(`Error getting followers from title: ${title}. Expected K or M`);
    }

    const num = parseFloat(match[1]);
    const unit = match[3].toUpperCase();

    if (unit === "K") {
      return `${Math.round(num)}K`;
    }

    if (unit === "M") {
      return Number.isInteger(num) ? `${num}M` : `${num}M`;
    }

    throw new Error(`Unsupported unit: ${unit}`);
  };

  replaceFollowersInTitle = (title: string): string => {
    const updatedNumber = this.getFollowersNumberPart(title);
    return title.replace(/\b\d+(\.\d+)?[KM]\b/i, updatedNumber);
  };
}
