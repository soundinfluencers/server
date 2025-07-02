import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OfferRemake } from './schemas/offer-remake.schema';
import { Influencer } from '../auth/schemas/influencer.schema';
import { OfferDto } from './dto/offer.dto';
import { SocialMediaEnum } from '../types/social-media.types';

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

  async importXlsxOffers(data: OfferDto[]): Promise<{
    code: number;
    createdCount: number;
    failedCount: number;
    created: { title: string }[];
    failed: { index: number; error: string }[];
  }> {
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
    const usernameToInfluencerId = new Map<string, Types.ObjectId>();
    influencers.forEach((influencer) => {
      const socialMediaField = influencer[socialMedia];
      if (socialMediaField) {
        socialMediaField.forEach((account) => {
          if (account.instagramUsername) {
            usernameToInfluencerId.set(account.instagramUsername, influencer._id);
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
            const influencerId = usernameToInfluencerId.get(username);
            if (!influencerId) {
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
              socialMediaUsername: username,
              influencerId,
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
          combinedFollowers: offerDto.combinedFollowers,
          networksAmount: offerDto.networksAmount,
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
