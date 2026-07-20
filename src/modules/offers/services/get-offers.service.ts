import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { CurrencyCode } from 'src/common/types/finance.types';
import {
  CommunityMusicGenres,
  CreatorMusicGenres,
  InfluencerProfileCategory,
} from 'src/common/types/influencer/influencer.types';
import { OfferSocialMediaEnum } from 'src/common/types/offer.types';
import { SocialMediaEnum } from 'src/common/types/social-media.types';
import { FilteredNestLogger } from 'src/common/logger/filtered-nest-logger';
import {
  OfferAccountLinkRepository,
  OfferAccountPair,
} from 'src/database/repositories/offers/offer-account-link.repository';
import { OfferRepository } from 'src/database/repositories/offers/offer.repository';
import { Offer } from 'src/database/schemas/offer/offer.schema';
import { InfluencerRepository } from 'src/database/repositories/users/influencer.repository';
import { ExchangeRateService } from 'src/integrations/exchange-rate/exchange-rate.service';
import { FoundAccountDto } from 'src/modules/profile/dto/influencer/get-profile.dto';
import { GetOffersParamsDto, OfferClientView } from '../dto/get-offers.dto';

type LinksByOfferId = Map<string, OfferAccountPair[]>;
type AccountIdsByInfluencer = Map<string, Set<string>>;

export const GET_OFFERS_SERVICE = Symbol('GET_OFFERS_SERVICE');
const OFFERS_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class GetOffersService {
  private readonly logger = new FilteredNestLogger(GetOffersService.name);

  constructor(
    private readonly exchangeRateService: ExchangeRateService,
    private readonly influencerRepository: InfluencerRepository,
    private readonly offerRepository: OfferRepository,
    private readonly offerAccountLinkRepository: OfferAccountLinkRepository,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async exec(payload: GetOffersParamsDto): Promise<OfferClientView[]> {
    const { socialMedia, genre, onlyPublished } = payload;
    const startedAt = Date.now();
    const cacheKey = this.buildCacheKey(socialMedia, genre, onlyPublished);

    this.logger.debug(
      `Get offers started: ${JSON.stringify({
        socialMedia,
        genre,
        onlyPublished,
        cacheKey,
      })}`,
    );

    const cachedOffers = await this.getCachedOffers(cacheKey);

    this.logger.debug(`Cached offers result: ${JSON.stringify(cachedOffers, null, '\t')}`);

    if (onlyPublished === true && cachedOffers !== undefined) {
      this.logger.debug(
        `Get offers completed from cache: ${JSON.stringify({
          cacheKey,
          offersAmount: cachedOffers.length,
          durationMs: Date.now() - startedAt,
        })}`,
      );
      return cachedOffers;
    }

    const offers = await this.getEffectiveOffers(socialMedia, genre, onlyPublished);

    if (offers.length === 0) {
      await this.cacheOffers(cacheKey, []);
      this.logger.debug(
        `Get offers completed without results: ${JSON.stringify({
          socialMedia,
          genre,
          onlyPublished,
          durationMs: Date.now() - startedAt,
        })}`,
      );
      return [];
    }

    const linksByOfferId = await this.getLinksByOfferId(offers);
    const accountIdsByInfluencer = this.collectAccountIdsByInfluencer(offers, linksByOfferId);
    const accountMap = await this.getAccountMap(socialMedia, accountIdsByInfluencer);
    const result = this.mapOffersToClientView(offers, linksByOfferId, accountMap);

    await this.cacheOffers(cacheKey, result);

    this.logger.debug(
      `Get offers completed: ${JSON.stringify({
        socialMedia,
        genre,
        onlyPublished,
        offersAmount: result.length,
        connectedAccountsAmount: result.reduce(
          (total, offer) => total + offer.connectedAccounts.length,
          0,
        ),
        durationMs: Date.now() - startedAt,
      })}`,
    );

    return result;
  }

  private async getEffectiveOffers(
    socialMedia: OfferSocialMediaEnum,
    genre: CommunityMusicGenres | CreatorMusicGenres,
    onlyPublished: boolean,
  ): Promise<Offer[]> {
    const baseOffers = await this.getBaseOffers(socialMedia, genre, onlyPublished);

    this.logger.debug(
      `Base offers fetched: ${JSON.stringify({
        socialMedia,
        genre,
        onlyPublished,
        offersAmount: baseOffers.length,
        publishedOffersAmount: baseOffers.filter((offer) => offer.isPublished).length,
        unpublishedOffersAmount: baseOffers.filter((offer) => !offer.isPublished).length,
      })}`,
    );

    if (onlyPublished || baseOffers.length === 0) {
      return baseOffers;
    }

    const publishedOffers = baseOffers.filter((offer) => offer.isPublished === true);

    if (publishedOffers.length === 0) {
      this.logger.debug(
        `Working copy lookup skipped: no published base offers for ${socialMedia}/${genre}`,
      );
      return baseOffers;
    }

    const workingCopies = await this.getWorkingCopies(publishedOffers, socialMedia, genre);
    const workingCopyByReferenceId = new Map<string, Offer>();
    let duplicateCopiesAmount = 0;

    for (const workingCopy of workingCopies) {
      const referenceId = workingCopy.referenceId?.toString();

      if (!referenceId) {
        continue;
      }

      if (workingCopyByReferenceId.has(referenceId)) {
        duplicateCopiesAmount += 1;
        continue;
      }

      workingCopyByReferenceId.set(referenceId, workingCopy);
    }

    const replacedOfferIds: string[] = [];
    const effectiveOffers = baseOffers.map((baseOffer) => {
      if (baseOffer.isPublished !== true) {
        return baseOffer;
      }

      const workingCopy = workingCopyByReferenceId.get(baseOffer._id.toString());

      if (!workingCopy) {
        return baseOffer;
      }

      replacedOfferIds.push(baseOffer._id.toString());
      return workingCopy;
    });

    this.logger.debug(
      `Effective offers resolved: ${JSON.stringify({
        baseOffersAmount: baseOffers.length,
        workingCopiesAmount: workingCopies.length,
        replacedOffersAmount: replacedOfferIds.length,
        replacedOfferIds,
        duplicateCopiesIgnoredAmount: duplicateCopiesAmount,
      })}`,
    );

    return effectiveOffers;
  }

  private async getBaseOffers(
    socialMedia: OfferSocialMediaEnum,
    genre: CommunityMusicGenres | CreatorMusicGenres,
    onlyPublished: boolean,
  ): Promise<Offer[]> {
    const filter = onlyPublished
      ? {
          socialMedia,
          genre,
          isPublished: true,
        }
      : {
          socialMedia,
          genre,
          referenceId: { $exists: false },
        };

    this.logger.debug(
      `Fetching base offers: ${JSON.stringify({
        socialMedia,
        genre,
        mode: onlyPublished ? 'published-only' : 'effective-drafts',
      })}`,
    );

    return this.offerRepository.findMany(filter, { lean: true });
  }

  private async getWorkingCopies(
    publishedOffers: Offer[],
    socialMedia: OfferSocialMediaEnum,
    genre: CommunityMusicGenres | CreatorMusicGenres,
  ): Promise<Offer[]> {
    const publishedOfferIds = publishedOffers.map((offer) => offer._id as Types.ObjectId);

    this.logger.debug(
      `Fetching working copies: ${JSON.stringify({
        socialMedia,
        genre,
        publishedOffersAmount: publishedOfferIds.length,
        publishedOfferIds: publishedOfferIds.map((id) => id.toString()),
      })}`,
    );

    const workingCopies = await this.offerRepository.findMany(
      {
        referenceId: { $in: publishedOfferIds },
        socialMedia,
        genre,
        isPublished: false,
      },
      {
        lean: true,
        sort: {
          updatedAt: -1,
          createdAt: -1,
          _id: -1,
        },
      },
    );

    this.logger.debug(
      `Working copies fetched: ${JSON.stringify({
        workingCopiesAmount: workingCopies.length,
        workingCopyIds: workingCopies.map((copy) => copy._id.toString()),
      })}`,
    );

    return workingCopies;
  }

  private async getLinksByOfferId(offers: Offer[]): Promise<LinksByOfferId> {
    const offerIds = offers.map((offer) => offer._id as Types.ObjectId);

    this.logger.debug(
      `Fetching offer account links: ${JSON.stringify({
        offersAmount: offerIds.length,
        offerIds: offerIds.map((id) => id.toString()),
      })}`,
    );

    const allLinks = await this.offerAccountLinkRepository.findByOfferIds(offerIds);
    const linksByOfferId: LinksByOfferId = new Map();

    for (const link of allLinks) {
      const offerId = link.offerId.toString();
      const pair: OfferAccountPair = {
        influencerId: link.influencerId as Types.ObjectId,
        accountId: link.accountId as Types.ObjectId,
      };
      const existingPairs = linksByOfferId.get(offerId);

      if (existingPairs) {
        existingPairs.push(pair);
      } else {
        linksByOfferId.set(offerId, [pair]);
      }
    }

    this.logger.debug(
      `Offer account links grouped: ${JSON.stringify({
        linksAmount: allLinks.length,
        offersWithLinksAmount: linksByOfferId.size,
        offersWithoutLinksAmount: offers.length - linksByOfferId.size,
      })}`,
    );

    return linksByOfferId;
  }

  private collectAccountIdsByInfluencer(
    offers: Offer[],
    linksByOfferId: LinksByOfferId,
  ): AccountIdsByInfluencer {
    const accountIdsByInfluencer: AccountIdsByInfluencer = new Map();

    for (const offer of offers) {
      const linkedAccounts = linksByOfferId.get(offer._id.toString()) ?? [];

      for (const account of linkedAccounts) {
        const influencerId = account.influencerId.toString();
        const accountId = account.accountId.toString();
        const accountIds = accountIdsByInfluencer.get(influencerId);

        if (accountIds) {
          accountIds.add(accountId);
        } else {
          accountIdsByInfluencer.set(influencerId, new Set([accountId]));
        }
      }
    }

    this.logger.debug(
      `Unique linked accounts collected: ${JSON.stringify({
        influencersAmount: accountIdsByInfluencer.size,
        accountsAmount: Array.from(accountIdsByInfluencer.values()).reduce(
          (total, accountIds) => total + accountIds.size,
          0,
        ),
      })}`,
    );

    return accountIdsByInfluencer;
  }

  private async getAccountMap(
    offerSocialMedia: OfferSocialMediaEnum,
    accountIdsByInfluencer: AccountIdsByInfluencer,
  ): Promise<Map<string, FoundAccountDto>> {
    const accountMap = new Map<string, FoundAccountDto>();

    if (accountIdsByInfluencer.size === 0) {
      this.logger.debug('Influencer account lookup skipped: offers have no account links');
      return accountMap;
    }

    const socialMedia = this.getAccountSocialMedia(offerSocialMedia);
    const influencerIds = Array.from(accountIdsByInfluencer.keys());
    const pairKeys = Array.from(accountIdsByInfluencer.entries()).flatMap(
      ([influencerId, accountIds]) =>
        Array.from(accountIds).map((accountId) => `${influencerId}_${accountId}`),
    );
    const exchangeRates = await this.getExchangeRates();
    const eurPriceExpression = { $ifNull: [`$${socialMedia}.publicPrice`, 0] };

    this.logger.debug(
      `Fetching linked influencer accounts: ${JSON.stringify({
        offerSocialMedia,
        accountSocialMedia: socialMedia,
        influencersAmount: influencerIds.length,
        accountPairsAmount: pairKeys.length,
      })}`,
    );

    const accountRows = await this.influencerRepository
      .aggregate([
        {
          $match: {
            _id: {
              $in: influencerIds.map((id) => new Types.ObjectId(id)),
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
            pairKey: { $in: pairKeys },
          },
        },
        {
          $project: {
            _id: 1,
            username: `$${socialMedia}.username`,
            logo: `$${socialMedia}.logoUrl`,
            accountId: `$${socialMedia}._id`,
            followers: `$${socialMedia}.followers`,
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
              EUR: eurPriceExpression,
              USD: {
                $round: [
                  {
                    $multiply: [eurPriceExpression, exchangeRates[CurrencyCode.USD] ?? 1.08],
                  },
                  0,
                ],
              },
              GBP: {
                $round: [
                  {
                    $multiply: [eurPriceExpression, exchangeRates[CurrencyCode.GBP] ?? 0.92],
                  },
                  0,
                ],
              },
            },
            averageViews: {
              $ifNull: [`$${socialMedia}.averageViews`, 0],
            },
            engagementRate: {
              $ifNull: [`$${socialMedia}.engagementRate`, 0],
            },
            profileCategory: `$${socialMedia}.profileCategory`,
          },
        },
      ])
      .exec();

    for (const accountRow of accountRows) {
      if (!accountRow.accountId) {
        continue;
      }

      const profileType =
        (accountRow.profileCategory as InfluencerProfileCategory | undefined) ??
        InfluencerProfileCategory.community;
      const key = `${accountRow._id.toString()}:${accountRow.accountId.toString()}`;

      accountMap.set(key, {
        accountId: accountRow.accountId.toString(),
        influencerId: accountRow._id.toString(),
        username: accountRow.username,
        logoUrl: accountRow.logo,
        followers: accountRow.followers,
        prices: accountRow.prices,
        averageViews: accountRow.averageViews,
        engagementRate: accountRow.engagementRate,
        socialMedia,
        profileType,
        countries: accountRow.countries?.length > 0 ? accountRow.countries : null,
        ...(profileType === InfluencerProfileCategory.community &&
        accountRow.communityMusicGenres?.length > 0
          ? { communityMusicGenres: accountRow.communityMusicGenres }
          : {}),
        ...(profileType === InfluencerProfileCategory.community &&
        accountRow.communityThemeTopics?.length > 0
          ? { communityThemeTopics: accountRow.communityThemeTopics }
          : {}),
        ...(profileType === InfluencerProfileCategory.creator &&
        accountRow.creatorMusicGenres?.length > 0
          ? { creatorMusicGenres: accountRow.creatorMusicGenres }
          : {}),
        ...(profileType === InfluencerProfileCategory.creator &&
        accountRow.creatorContentFocus?.length > 0
          ? { creatorContentFocus: accountRow.creatorContentFocus }
          : {}),
      });
    }

    this.logger.debug(
      `Linked influencer accounts fetched: ${JSON.stringify({
        requestedAccountsAmount: pairKeys.length,
        foundAccountsAmount: accountMap.size,
        missingAccountsAmount: pairKeys.length - accountMap.size,
      })}`,
    );

    return accountMap;
  }

  private async getExchangeRates(): Promise<Record<CurrencyCode, number>> {
    const exchangeRates = await this.exchangeRateService.getAllRates();

    this.logger.debug(
      `Exchange rates fetched: ${JSON.stringify({
        currencies: Object.keys(exchangeRates),
      })}`,
    );

    return exchangeRates;
  }

  private mapOffersToClientView(
    offers: Offer[],
    linksByOfferId: LinksByOfferId,
    accountMap: Map<string, FoundAccountDto>,
  ): OfferClientView[] {
    let missingLinkedAccountsAmount = 0;

    const result = offers.map((offer): OfferClientView => {
      const linkedAccounts = linksByOfferId.get(offer._id.toString()) ?? [];
      const connectedAccounts = linkedAccounts
        .map((account) => {
          const accountData = accountMap.get(
            `${account.influencerId.toString()}:${account.accountId.toString()}`,
          );

          if (!accountData) {
            missingLinkedAccountsAmount += 1;
            return null;
          }

          return accountData;
        })
        .filter((account): account is FoundAccountDto => account !== null);

      return {
        _id: offer._id.toString(),
        title: offer.title,
        socialMedia: this.getAccountSocialMedia(offer.socialMedia),
        price: offer.price,
        genre: offer.genre,
        combinedFollowers: offer.combinedFollowers,
        networksAmount: offer.networksAmount,
        storyAndPostDetails: `${offer.networksAmount} Post + Story across`,
        connectedAccounts,
      };
    });

    this.logger.debug(
      `Offers mapped to client view: ${JSON.stringify({
        offersAmount: result.length,
        availableAccountsAmount: accountMap.size,
        missingLinkedAccountsAmount,
      })}`,
    );

    return result;
  }

  private getAccountSocialMedia(socialMedia: OfferSocialMediaEnum): SocialMediaEnum {
    return socialMedia.replace(/_(creators|communities)$/, '') as SocialMediaEnum;
  }

  private buildCacheKey(
    socialMedia: OfferSocialMediaEnum,
    genre: CommunityMusicGenres | CreatorMusicGenres,
    onlyPublished: boolean,
  ): string {
    const mode = onlyPublished ? 'published' : 'effective';
    return `offers:v2:${socialMedia}:${genre.toLowerCase()}:${mode}`;
  }

  private async getCachedOffers(cacheKey: string): Promise<OfferClientView[] | undefined> {
    try {
      const cachedOffers = await this.cacheManager.get<OfferClientView[]>(cacheKey);

      this.logger.debug(
        `Offers cache lookup completed: ${JSON.stringify({
          cacheKey,
          cacheHit: cachedOffers !== undefined && cachedOffers !== null,
          cachedOffersAmount: cachedOffers?.length ?? 0,
        })}`,
      );

      return cachedOffers ?? undefined;
    } catch (error) {
      this.logger.debug(
        `Offers cache lookup failed: ${JSON.stringify({
          cacheKey,
          error: error instanceof Error ? error.message : String(error),
        })}`,
      );
      return undefined;
    }
  }

  private async cacheOffers(cacheKey: string, offers: OfferClientView[]): Promise<void> {
    try {
      await this.cacheManager.set(cacheKey, offers, OFFERS_CACHE_TTL_MS);
      this.logger.debug(
        `Offers cached: ${JSON.stringify({
          cacheKey,
          offersAmount: offers.length,
          ttlMs: OFFERS_CACHE_TTL_MS,
        })}`,
      );
    } catch (error) {
      this.logger.debug(
        `Offers cache write failed: ${JSON.stringify({
          cacheKey,
          offersAmount: offers.length,
          error: error instanceof Error ? error.message : String(error),
        })}`,
      );
    }
  }
}
