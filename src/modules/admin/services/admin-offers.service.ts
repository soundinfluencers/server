import {BadRequestException, Injectable, InternalServerErrorException, NotFoundException} from '@nestjs/common';
import {
    AdminOffersMatrixAccountRowDto,
    AdminOffersMatrixDto,
    AdminOffersMatrixLinkDto,
    AdminOffersMatrixOfferHeaderDto,
    AdminOffersMatrixToggleLinkDto,
    GetAdminOffersMatrixQuery,
    UpdateOfferFieldDto
} from '../dto/offers/admin-offers-matrix.dto';
import {OfferAccountLinkRepository} from '../../../database/repositories/offers/offer-account-link.repository';
import {SocialMediaEnum} from '../../../common/types/social-media.types';
import {
    OfferHeaderRow,
    OfferRepository,
    OffersMatrixAccountRow
} from "../../../database/repositories/offers/offer.repository";
import {ObjId} from "../../../common/types/base.types";

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
    constructor(
        private readonly offerRepository: OfferRepository,
        private readonly offerAccountLinkRepository: OfferAccountLinkRepository,
    ) {
    }

    async getMatrix(query: GetAdminOffersMatrixQuery): Promise<AdminOffersMatrixDto> {
        const offersTake = query.offersTake && query.offersTake > 0 ? query.offersTake : 10;
        const accountsTake = query.accountsTake && query.accountsTake > 0 ? query.accountsTake : 10;

        // 1. Load paginated offer headers (matrix columns)
        const offersPage = await this.getOffersHeadersPage({
            socialMedia: query.socialMedia,
            genre: query.genre,
            take: offersTake,
            cursor: this.decodeOffersCursor(query.offersCursor),
        });

        if (!offersPage.items.length) throw new NotFoundException('No offers found. Please check your filters and try again.');

        const offerIds = offersPage.items.map((o) => new ObjId(o.offerId));

        // 2. Load paginated account rows (matrix rows)
        const accountsPage = await this.getAccountRowsPage({
            socialMedia: query.socialMedia,
            genre: query.genre,
            take: accountsTake,
            cursor: this.decodeAccountsCursor(query.accountsCursor),
        });

        if (!accountsPage.items.length) throw new NotFoundException("Something went wrong. No accounts found.");

        const accountPairs = accountsPage.items.map((r) => ({
            influencerId: new ObjId(r.influencerId),
            accountId: new ObjId(r.accountId),
        }));

        // 3. Load only existing links for the current viewport
        const linkDocs =
            offerIds.length && accountPairs.length
                ? await this.offerAccountLinkRepository.findViewportLinks({
                    offerIds,
                    accountPairs,
                })
                : [];

        const links: AdminOffersMatrixLinkDto[] = linkDocs.map((l) => ({
            offerId: l.offerId.toString(),
            influencerId: l.influencerId.toString(),
            accountId: l.accountId.toString(),
        }));

        return {
            offerHeaders: offersPage.items,
            offersNextCursor: offersPage.nextCursor,
            accountRows: accountsPage.items,
            accountsNextCursor: accountsPage.nextCursor,
            links,
        };
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
            await this.offerRepository.updateOne({_id: offerId}, {$set: {networksAmount: n}});

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }

        return {ok: true};
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

    async setPublishedStatus(offerId?: string): Promise<void> {
        if (offerId) {
            await this.offerRepository.updatePublishedStatusOne(offerId);
        } else {
            await this.offerRepository.updatePublishedStatusMany();
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

    private async getOffersHeadersPage(params: {
        socialMedia: SocialMediaEnum;
        genre: string;
        take: number;
        cursor: OffersMatrixOfferCursor | null;
    }): Promise<{
        items: AdminOffersMatrixOfferHeaderDto[];
        nextCursor: string | null;
    }> {
        const {take} = params;

        const rows: OfferHeaderRow[] = await this.offerRepository.getOffersHeadersPage(params);

        const hasNextPage = rows.length > take;
        const pageRows = hasNextPage ? rows.slice(0, take) : rows;
        const last = pageRows[pageRows.length - 1];

        const items: AdminOffersMatrixOfferHeaderDto[] = pageRows.map((row) => ({
            offerId: row.offerId.toString(),
            title: row.title,
            isPublished: row.isPublished,
            price: row.price,
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
        socialMedia: SocialMediaEnum;
        genre: string;
        take: number;
        cursor: OffersMatrixAccountCursor | null;
    }): Promise<{
        items: AdminOffersMatrixAccountRowDto[];
        nextCursor: string | null;
    }> {
        const {take} = params;

        const rows: OffersMatrixAccountRow[] =
            await this.offerRepository.getOffersMatrixAccountRowsPage(params);

        const hasNextPage = rows.length > take;
        const pageRows = hasNextPage ? rows.slice(0, take) : rows;
        const last = pageRows[pageRows.length - 1];

        const items: AdminOffersMatrixAccountRowDto[] = pageRows.map((r) => ({
            influencerId: r.influencerId.toString(),
            accountId: r.accountId.toString(),
            username: r.username,
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
            return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as OffersMatrixAccountCursor;
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
