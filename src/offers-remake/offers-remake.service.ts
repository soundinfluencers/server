import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OfferRemake } from './schemas/offer-remake.schema';
import { Influencer } from '../auth/schemas/influencer.schema';
import { OfferDto } from './dto/offer.dto';
import { SocialMediaType } from '../types/social-media.types';

@Injectable()
export class OffersRemakeService {
  private readonly logger = new Logger();

  constructor(
    @InjectModel(OfferRemake.name) private offersModel: Model<OfferRemake>,
    @InjectModel(Influencer.name) private readonly influencerModel: Model<Influencer>,
  ) {}

  async createOffer(offer: OfferRemake) {
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

  async getOffersByGenreAndSocialMedia(
    socialMedia: SocialMediaType,
    genre: string,
  ): Promise<{
    code: number;
    message: string;
    offers: OfferRemake[] | null;
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

      // Map для быстрого доступа к socialMediaUsername и logo
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
    failed: { index: number; error: string }[];
  }> {
    if (data.every((item) => item.socialMedia !== 'press' && !item.genre)) {
      return {
        code: 500,
        createdCount: 0,
        failedCount: 1,
        created: [],
        failed: [{ index: 0, error: 'Only press offers can be created without social media!' }],
      };
    }

    // Мап юзернеймов, дабы в будущем не тратить времени на уже найденные
    const allUsernames = new Set<string>();
    data.forEach((offerDto) => {
      offerDto.connectedAccounts.forEach((username) => allUsernames.add(username.trim()));
    });

    // Проверка на одинаковую соц сеть
    const socialMedia = data[0]?.socialMedia;
    if (!socialMedia || data.some((dto) => dto.socialMedia !== socialMedia)) {
      throw new Error('All offers must have the same social media type');
    }

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
        // Формирование connectedAccounts с influencerId
        const connectedAccounts = offerDto.connectedAccounts
          .map((username) => {
            const influencerData = usernameToInfluencerId.get(username);
            if (!influencerData) {
              failed.push({
                title: offerDto.title,
                index: index,
                error: `Can't find influencer with username "${username}"`,
              });
              this.logger.error(
                `Offer ${offerDto.title}: Can't find influencer with username "${username}"`,
                new Error().stack,
              );
              return null;
            }
            return {
              _id: new Types.ObjectId(),
              accountId: influencerData.accountId,
              influencerId: influencerData.influencerId,
            };
          })
          .filter(Boolean);

        if (!connectedAccounts.length) {
          this.logger.error(
            `No valid connected accounts found for offer: ${offerDto.title}`,
            new Error().stack,
          );
          failed.push({
            title: offerDto.title,
            index: index,
            error: `No valid connected accounts found`,
          });
          throw new Error(`Connected accounts is empty array ${offerDto.title}`);
        }

        const offer = {
          title: offerDto.title,
          socialMedia: offerDto.socialMedia,
          connectedAccounts: connectedAccounts,
          price: offerDto.price,
          genre: offerDto.genre,
          combinedFollowers: offerDto.socialMedia !== 'press' ? offerDto.title : null,
          networksAmount: connectedAccounts.length || null,
          storyAndPostDetails: offerDto.storyAndPostDetails,
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
  }
}
