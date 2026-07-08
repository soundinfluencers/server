import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminCreateOfferDto,
  AdminOffersMatrixAccountRowDto,
  AdminOffersMatrixDto,
  AdminOffersMatrixLinkDto,
  AdminOffersMatrixOfferHeaderDto,
  AdminOffersMatrixToggleLinkDto,
  GetAdminOffersMatrixQuery,
  UpdateOfferFieldDto,
} from '../dto/offers/admin-offers-matrix.dto';
import { OfferAccountLinkRepository } from '../../../database/repositories/offers/offer-account-link.repository';
import {
  OfferHeaderRow,
  OfferRepository,
  OffersMatrixAccountRow,
} from '../../../database/repositories/offers/offer.repository';
import { ObjId } from '../../../common/types/base.types';
import { XlsxImporter } from '../../../common/utils/import/xlsx/xlsx-import';
import { Offer } from '../../../database/schemas/offer/offer.schema';
import { Influencer } from '../../../database/schemas/users/influencer.schema';
import { InfluencerRepository } from '../../../database/repositories/users/influencer.repository';
import { Types } from 'mongoose';
import { XlsxOffersImportSummary } from '../dto/offers/xlsx-offers-import.dto';
import { FilteredNestLogger } from 'src/common/logger/filtered-nest-logger';
import { OfferSocialMediaEnum } from 'src/common/types/offer.types';
import {
  CommunityMusicGenres,
  CreatorMusicGenres,
} from 'src/common/types/influencer/influencer.types';

export interface OffersMatrixOfferCursor {
  createdAt: Date;
  offerId: string;
}

export interface OffersMatrixAccountCursor {
  sortUsername: string;
  influencerId: string;
  accountId: string;
}

export type OfferFieldRecord = {
  title: string;
  price: number;
  combinedFollowers: string;
  networkAmount: number;
  storyAndPostDetails: string;
  isPublished: boolean;
};

export type UpdateOfferFieldInput<K extends keyof OfferFieldRecord = keyof OfferFieldRecord> = {
  offerId: string;
  field: K;
  value: OfferFieldRecord[K];
};

const offerFieldTypes: Record<keyof OfferFieldRecord, 'string' | 'number' | 'boolean'> = {
  title: 'string',
  price: 'number',
  combinedFollowers: 'string',
  networkAmount: 'number',
  storyAndPostDetails: 'string',
  isPublished: 'boolean',
};

@Injectable()
export class AdminOffersService {
  private readonly logger = new FilteredNestLogger(AdminOffersService.name);

  constructor(
    private readonly offerRepository: OfferRepository,
    private readonly offerAccountLinkRepository: OfferAccountLinkRepository,
    private readonly xlsxImporter: XlsxImporter,
    private readonly influencerRepository: InfluencerRepository,
  ) { }

  async getMatrix(query: GetAdminOffersMatrixQuery): Promise<AdminOffersMatrixDto> {
    const offersTake = query.offersTake && query.offersTake > 0 ? query.offersTake : 10;
    const accountsTake = query.accountsTake && query.accountsTake > 0 ? query.accountsTake : 10;

    // 1. Load paginated account rows (matrix rows)
    const accountsPage = await this.getAccountRowsPage({
      socialMedia: query.socialMedia,
      genre: query.genre,
      take: accountsTake,
      cursor: this.decodeAccountsCursor(query.accountsCursor),
    });

    if (!accountsPage.items.length)
      throw new NotFoundException('Something went wrong. No accounts found.');

    const accountPairs = accountsPage.items.map((r) => ({
      influencerId: new ObjId(r.influencerId),
      accountId: new ObjId(r.accountId),
    }));

    // 2. Load paginated offer headers (matrix columns)
    const offersPage = await this.getOffersHeadersPage({
      socialMedia: query.socialMedia,
      genre: query.genre,
      take: offersTake,
      cursor: this.decodeOffersCursor(query.offersCursor),
    });

    let links = [];

    if (offersPage?.items?.length > 0) {
      const offerIds = offersPage.items.map((o) => new ObjId(o.offerId));

      // 3. Load only existing links for the current viewport
      const linkDocs =
        offerIds.length && accountPairs.length
          ? await this.offerAccountLinkRepository.findViewportLinks({
            offerIds,
            accountPairs,
          })
          : [];


      for (const link of linkDocs) {
        links.push({
          offerId: link.offerId.toString(),
          influencerId: link.influencerId.toString(),
          accountId: link.accountId.toString(),
        })
      }
    }

    return {
      offerHeaders: offersPage?.items?.length > 0 ? offersPage.items : [],
      offersNextCursor: offersPage.nextCursor,
      accountRows: accountsPage.items,
      accountsNextCursor: accountsPage.nextCursor,
      links,
    };
  }

  async createOffer(data: AdminCreateOfferDto): Promise<void> {
    await this.offerRepository.create({
      _id: new ObjId(),
      title: data.offerName,
      socialMedia: data.socialMedia,
      price: 0,
      genre: data.genre,
      isPublished: false,
      combinedFollowers: 0,
      networksAmount: '0',
      storyAndPostDetails: '0',
    } satisfies Offer);
  }

  async toggleLink(dto: AdminOffersMatrixToggleLinkDto): Promise<{ ok: boolean }> {
    const offerId = new ObjId(dto.offerId);
    const influencerId = new ObjId(dto.influencerId);
    const accountId = new ObjId(dto.accountId);

    const session = await this.offerAccountLinkRepository.startSession();
    session.startTransaction();

    try {
      if (dto.connected) {
        await this.offerAccountLinkRepository.addLink(offerId, influencerId, accountId, session);
      } else {
        await this.offerAccountLinkRepository.removeLink(offerId, influencerId, accountId, session);
      }

      const n = await this.offerAccountLinkRepository.countByOfferId(offerId, session);
      await this.offerRepository.updateOne({ _id: offerId }, { $set: { networksAmount: n } });

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }

    return { ok: true };
  }

  async updateField(offerId: string, payload: UpdateOfferFieldDto): Promise<void> {
    const allowedFields: (keyof OfferFieldRecord)[] = [
      'title',
      'price',
      'combinedFollowers',
      'networkAmount',
      'storyAndPostDetails',
      'isPublished',
    ];

    if (!allowedFields.includes(payload.field as keyof OfferFieldRecord)) {
      throw new BadRequestException('Invalid offer field');
    }

    const field = payload.field as keyof OfferFieldRecord;

    if (!this.validateOfferFieldValue(field, payload.value)) {
      throw new BadRequestException(`Invalid value type for field "${field}"`);
    }

    const offer = await this.offerRepository.updateOneField({
      offerId: offerId,
      field,
      value: payload.value,
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
  }

  async changePublishedStatuses(socialMedia: OfferSocialMediaEnum, genre: CommunityMusicGenres | CreatorMusicGenres): Promise<void> {
    const updateResult = await this.offerRepository.changePublishedStatuses(socialMedia, genre);

    if (updateResult.matchedCount === 0) {
      this.logger.warn(`Didn't change isPublished status for ${socialMedia} offers with genre ${genre}. updateResult object: ${JSON.stringify(updateResult, null, '\t')}`);
      throw new NotFoundException(`Offers not found`);
    }
  }

  async deleteOffer(offerId: string): Promise<void> {
    const result = await this.offerRepository.delete(offerId);

    if (!result || result.deletedCount === 0) {
      throw new NotFoundException('Offer not found.');
    }

    if (result.deletedCount !== 1) {
      throw new InternalServerErrorException("Something went wrong. Offer wasn't deleted.");
    }
  }

  async importXlsxOffers(
    socialMedia: OfferSocialMediaEnum,
    file: Express.Multer.File,
  ): Promise<XlsxOffersImportSummary> {
    const parsed = await this.xlsxImporter.importOffers(file);

    if (!parsed.offerBlocks.length && !parsed.globalErrors.length) {
      throw new BadRequestException('No offer blocks found in xlsx');
    }

    const summary: XlsxOffersImportSummary = {
      createdOffers: 0,
      skippedOffers: 0,
      totalAccounts: 0,
      matchedAccounts: 0,
      unmatchedAccounts: [],
      errors: parsed.globalErrors.map((e) => ({ sheetName: e.sheetName, message: e.message })),
    };

    for (const block of parsed.offerBlocks) {
      const genre = block.sheetName;
      const title = block.offerName;

      for (const re of block.rowErrors) {
        summary.errors.push({
          sheetName: block.sheetName,
          offerName: title,
          rowNumber: re.rowNumber,
          message: re.message,
        });
      }

      let offerId: Types.ObjectId;

      // Idempotent: reuse existing offer with same title+socialMedia+genre
      const existing = await this.offerRepository.findOne({ title, socialMedia, genre });

      if (existing) {
        offerId = (existing as any)._id as Types.ObjectId;
        summary.skippedOffers++;
      } else {
        const created = await this.offerRepository.create({
          _id: new Types.ObjectId(),
          title,
          socialMedia,
          genre,
          price: block.price,
          combinedFollowers: block.totalFollowers,
          networksAmount: block.accounts.length,
          isPublished: true,
          ...(block.storyAndPostDetails ? { storyAndPostDetails: block.storyAndPostDetails } : {}),
        } as unknown as Partial<Offer>);
        offerId = (created as any)._id as Types.ObjectId;
        summary.createdOffers++;
      }

      summary.totalAccounts += block.accounts.length;

      if (!block.accounts.length) {
        continue;
      }

      // Extract and deduplicate usernames
      const usernames = block.accounts
        .map((a) => a.pageName)
        .filter((u): u is string => u !== null);

      if (!usernames.length) {
        continue;
      }

      // Batch-load influencers matching any of these usernames
      const influencers: Influencer[] = await this.influencerRepository.findMany({
        [`${socialMedia}.username`]: { $in: usernames },
      });

      // username (lower) → first matched {influencerId, accountId}
      const accountMap = new Map<
        string,
        { influencerId: Types.ObjectId; accountId: Types.ObjectId }
      >();

      for (const influencer of influencers) {
        const socialAccounts = ((influencer as any)[socialMedia] ?? []) as any[];
        for (const acc of socialAccounts) {
          const uname = acc.username as string | undefined;
          if (uname && !accountMap.has(uname)) {
            accountMap.set(uname, {
              influencerId: influencer._id as Types.ObjectId,
              accountId: acc._id as Types.ObjectId,
            });
          }
        }
      }

      // Create links for matched accounts (addLink is idempotent via upsert)
      for (const account of block.accounts) {
        const username = account.pageName;

        if (!username) {
          continue;
        }

        const match = accountMap.get(username);

        if (!match) {
          summary.unmatchedAccounts.push({
            offerName: block.offerName,
            sheetName: block.sheetName,
            username,
          });
          continue;
        }

        try {
          await this.offerAccountLinkRepository.addLink(
            offerId,
            match.influencerId,
            match.accountId,
          );
          summary.matchedAccounts++;
        } catch (err: any) {
          if (err?.code !== 11000) {
            summary.errors.push({
              sheetName: block.sheetName,
              offerName: block.offerName,
              message: err?.message ?? 'Failed to create offer-account link',
            });
          }
        }
      }
    }

    return summary;
  }

  private async getOffersHeadersPage(params: {
    socialMedia: OfferSocialMediaEnum;
    genre: CommunityMusicGenres | CreatorMusicGenres;
    take: number;
    cursor: OffersMatrixOfferCursor | null;
  }): Promise<{
    items: AdminOffersMatrixOfferHeaderDto[];
    nextCursor: string | null;
  }> {
    const { take } = params;

    const rows: OfferHeaderRow[] = await this.offerRepository.getOffersHeadersPage(params);

    const hasNextPage = rows.length > take;
    const pageRows = hasNextPage ? rows.slice(0, take) : rows;
    const last = pageRows[pageRows.length - 1];

    const items: AdminOffersMatrixOfferHeaderDto[] = pageRows.map((row) => ({
      offerId: row.offerId.toString(),
      title: row.title,
      isPublished: row.isPublished,
      offerPrice: row.offerPrice, // custom price
      costPrice: row.costPrice, // auto-price - accounts' prices sum
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      items,
      nextCursor:
        hasNextPage && last
          ? this.encodeOffersCursor({
            createdAt: last.createdAt,
            offerId: last.offerId.toString(),
          })
          : null,
    };
  }

  private async getAccountRowsPage(params: {
    socialMedia: OfferSocialMediaEnum;
    genre: CommunityMusicGenres | CreatorMusicGenres;
    take: number;
    cursor: OffersMatrixAccountCursor | null;
  }): Promise<{
    items: AdminOffersMatrixAccountRowDto[];
    nextCursor: string | null;
  }> {
    const { take } = params;

    const rows: OffersMatrixAccountRow[] =
      await this.offerRepository.getOffersMatrixAccountRowsPage(params);

    const hasNextPage = rows.length > take;
    const pageRows = hasNextPage ? rows.slice(0, take) : rows;
    const last = pageRows[pageRows.length - 1];

    const items: AdminOffersMatrixAccountRowDto[] = pageRows.map((r) => ({
      influencerId: r.influencerId.toString(),
      accountId: r.accountId.toString(),
      username: r.username,
      followers: r.followers,
      price: r.publicPrice,
      pricePerFollower: Number((r.publicPrice / r.followers).toFixed(8)),
      logoUrl: r.logoUrl,
    }));

    return {
      items,
      nextCursor:
        hasNextPage && last
          ? this.encodeAccountsCursor({
            sortUsername: last.sortUsername,
            influencerId: last.influencerId.toString(),
            accountId: last.accountId.toString(),
          })
          : null,
    };
  }

  private encodeOffersCursor(c: { createdAt: Date; offerId: string }): string {
    const createdAt = c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt);
    return Buffer.from(
      JSON.stringify({
        createdAt: createdAt.toISOString(),
        offerId: c.offerId,
      }),
      'utf8',
    ).toString('base64');
  }

  private decodeOffersCursor(cursor?: string): OffersMatrixOfferCursor | null {
    if (!cursor) return null;
    try {
      const raw = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
        createdAt: string;
        offerId: string;
      };
      return {
        createdAt: new Date(raw.createdAt),
        offerId: raw.offerId,
      };
    } catch {
      return null;
    }
  }

  private encodeAccountsCursor(c: OffersMatrixAccountCursor): string {
    return Buffer.from(JSON.stringify(c), 'utf8').toString('base64');
  }

  private decodeAccountsCursor(cursor?: string): OffersMatrixAccountCursor | null {
    if (!cursor) return null;
    try {
      return JSON.parse(
        Buffer.from(cursor, 'base64').toString('utf8'),
      ) as OffersMatrixAccountCursor;
    } catch {
      return null;
    }
  }

  private validateOfferFieldValue(
    field: keyof OfferFieldRecord,
    value: unknown,
  ): value is OfferFieldRecord[typeof field] {
    return typeof value === offerFieldTypes[field];
  }
}
