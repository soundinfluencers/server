import { Inject, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  OfferAccountLinkRepository,
  OfferAccountPair,
} from '../../database/repositories/offers/offer-account-link.repository';
import {
  FilteredPublishedOffersByGenreAndSocialMedia,
  GetFilteredPublishedOffers,
} from './dto/get-offers.dto';
import { FoundAccountDto } from '../profile/dto/influencer/get-profile.dto';
import { InfluencerProfileCategory } from '../../common/types/influencer/influencer.types';
import { CurrencyCode } from '../../common/types/finance.types';
import { ExchangeRateService } from '../../integrations/exchange-rate/exchange-rate.service';
import { OfferRepository } from '../../database/repositories/offers/offer.repository';
import { InfluencerRepository } from '../../database/repositories/users/influencer.repository';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { SocialMediaEnum } from '../../common/types/social-media.types';

@Injectable()
export class OffersService {
  constructor(
    private readonly exchangeRateService: ExchangeRateService,
    private readonly influencerRepository: InfluencerRepository,
    private readonly offerRepository: OfferRepository,
    private readonly offerAccountLinkRepository: OfferAccountLinkRepository,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async getPublishedOffersByGenreAndSocialMedia(
    data: GetFilteredPublishedOffers,
  ): Promise<FilteredPublishedOffersByGenreAndSocialMedia[]> {
    const { socialMedia, genre } = data;

    const cacheKey = this.buildCacheKey(genre, socialMedia);
    const cachedOffers =
      await this.cacheManager.get<FilteredPublishedOffersByGenreAndSocialMedia[]>(cacheKey);

    if (cachedOffers !== undefined) {
      return cachedOffers;
    }

    const offers = await this.offerRepository.findMany(
      {
        socialMedia,
        genre,
        isPublished: true,
      },
      {
        lean: true,
      },
    );

    if (!offers?.length) return [];

    const offerIds = offers.map((o) => o._id as Types.ObjectId);
    const allLinks = await this.offerAccountLinkRepository.findByOfferIds(offerIds);
    const linksByOfferId = new Map<string, OfferAccountPair[]>();
    for (const link of allLinks) {
      const oid = link.offerId.toString();
      if (!linksByOfferId.has(oid)) {
        linksByOfferId.set(oid, []);
      }
      linksByOfferId.get(oid)!.push({
        influencerId: link.influencerId as Types.ObjectId,
        accountId: link.accountId as Types.ObjectId,
      });
    }

    // Getting latest exchanging rates for available currencies
    const exchangeRates: Record<CurrencyCode, number> =
      await this.exchangeRateService.getAllRates();

    // Уникальные пары influencerId и accountId
    const accountIdsMap = new Map<string, Set<string>>();
    for (const offer of offers) {
      const pairs = linksByOfferId.get(offer._id.toString()) ?? [];
      for (const account of pairs) {
        const influencerIdStr = account.influencerId.toString();
        const accountIdStr = account.accountId.toString();
        if (!accountIdsMap.has(influencerIdStr)) {
          accountIdsMap.set(influencerIdStr, new Set());
        }
        accountIdsMap.get(influencerIdStr)!.add(accountIdStr);
      }
    }

    // Генерация массива пар
    const pairs = Array.from(accountIdsMap.entries()).flatMap(([influencerId, accountIds]) =>
      Array.from(accountIds).map((accountId) => `${influencerId}_${accountId}`),
    );

    const eurPriceExpr = { $ifNull: [`$${socialMedia}.publicPrice`, 0] };

    // Агрегация инфлюенсеров и извлекание нужных для FoundAccountDto полей
    const influencers = await this.influencerRepository
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
            username: `$${socialMedia}.username`,
            logo: `$${socialMedia}.logoUrl`,
            accountId: `$${socialMedia}._id`,
            followers: `$${socialMedia}.followers`,
            publicPrice: `$${socialMedia}.publicPrice`,
            countries: {
              $cond: [{ $isArray: `$${socialMedia}.countries` }, `$${socialMedia}.countries`, []],
            },
            communityMusicGenres: {
              $cond: [
                { $isArray: `$${socialMedia}.communityMusicGenres` },
                `$${socialMedia}.communityMusicGenres`,
                [],
              ],
            },
            communityThemeTopics: {
              $cond: [
                { $isArray: `$${socialMedia}.communityThemeTopics` },
                `$${socialMedia}.communityThemeTopics`,
                [],
              ],
            },
            creatorMusicGenres: {
              $cond: [
                { $isArray: `$${socialMedia}.creatorMusicGenres` },
                `$${socialMedia}.creatorMusicGenres`,
                [],
              ],
            },
            creatorContentFocus: {
              $cond: [
                { $isArray: `$${socialMedia}.creatorContentFocus` },
                `$${socialMedia}.creatorContentFocus`,
                [],
              ],
            },
            prices: {
              EUR: eurPriceExpr,

              USD: {
                $round: [{ $multiply: [eurPriceExpr, exchangeRates[CurrencyCode.USD] ?? 1.08] }, 0],
              },

              GBP: {
                $round: [{ $multiply: [eurPriceExpr, exchangeRates[CurrencyCode.GBP] ?? 0.92] }, 0],
              },
            },

            averageViews: { $ifNull: [`$${socialMedia}.averageViews`, 0] },
            engagementRate: { $ifNull: [`$${socialMedia}.engagementRate`, 0] },
            profileCategory: `$${socialMedia}.profileCategory`,
          },
        },
      ])
      .exec();

    // Map для быстрого доступа к полям аккаунтов
    const accountMap = new Map<string, FoundAccountDto>();
    influencers.forEach((influencer) => {
      if (influencer.accountId) {
        accountMap.set(`${influencer._id.toString()}:${influencer.accountId.toString()}`, {
          accountId: influencer.accountId.toString(),
          influencerId: influencer._id.toString(),
          username: influencer.username,
          logoUrl: influencer.logo,
          followers: influencer.followers,
          prices: influencer.prices,
          averageViews: influencer.averageViews,
          engagementRate: influencer.engagementRate,
          socialMedia: socialMedia,
          profileType:
            (influencer.profileCategory as InfluencerProfileCategory | undefined) ??
            InfluencerProfileCategory.community,
          countries: influencer.countries?.length > 0 ? influencer.countries : null,
          ...(influencer.profileCategory === InfluencerProfileCategory.community &&
          influencer?.communityMusicGenres?.length > 0
            ? { communityMusicGenres: influencer.communityMusicGenres }
            : {}),
          ...(influencer.profileCategory === InfluencerProfileCategory.community &&
          influencer?.communityThemeTopics?.length > 0
            ? { communityThemeTopics: influencer.communityThemeTopics }
            : {}),
          ...(influencer.profileCategory === InfluencerProfileCategory.creator &&
          influencer?.creatorMusicGenres?.length > 0
            ? { creatorMusicGenres: influencer.creatorMusicGenres }
            : {}),
          ...(influencer.profileCategory === InfluencerProfileCategory.creator &&
          influencer?.creatorContentFocus?.length > 0
            ? { creatorContentFocus: influencer.creatorContentFocus }
            : {}),
        });
      }
    });

    const result =
      offers?.map((offer): FilteredPublishedOffersByGenreAndSocialMedia => {
        const pairs = linksByOfferId.get(offer._id.toString()) ?? [];
        return {
          _id: offer._id.toString(),
          title: offer.title,
          socialMedia: offer.socialMedia,
          price: offer.price,
          genre: offer.genre,
          combinedFollowers: offer.combinedFollowers,
          networksAmount: offer.networksAmount,
          storyAndPostDetails: offer.storyAndPostDetails,
          connectedAccounts: pairs
            .map((account) => {
              const accountData = accountMap.get(
                `${account.influencerId.toString()}:${account.accountId.toString()}`,
              );

              if (!accountData) return null;

              return {
                ...accountData,
              };
            })
            .filter((acc): acc is FoundAccountDto => acc !== null),
        };
      }) ?? [];

    await this.cacheManager.set(cacheKey, result, 5 * 60 * 1000);
    return result;
  }

  private buildCacheKey(genre: string, socialMedia: SocialMediaEnum): string {
    return `offers:v1:${socialMedia}:${genre.toLowerCase()}`;
  }
}
