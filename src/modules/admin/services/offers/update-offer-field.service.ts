import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { OfferRepository } from "src/database/repositories/offers/offer.repository";
import { Offer } from "src/database/schemas/offer/offer.schema";
import { AdminCreateOfferDto, UpdateOfferFieldDto } from "../../dto/offers/admin-offers-matrix.dto";
import { CREATE_OFFER_SERVICE, CreateOfferService } from "./create-offer.service";
import { ClientSession, UpdateQuery } from "mongoose";
import { ObjId } from "src/common/types/base.types";
import { FilteredNestLogger } from "src/common/logger/filtered-nest-logger";
import { OfferAccountLinkRepository } from "src/database/repositories/offers/offer-account-link.repository";

export type OfferFieldRecord = {
    title: string;
    price: number;
    storyAndPostDetails: string;
};

export type UpdateOfferFieldInput<K extends keyof OfferFieldRecord = keyof OfferFieldRecord> = {
    offerId: string;
    field: K;
    value: OfferFieldRecord[K];
};

const offerFieldTypes: Record<keyof OfferFieldRecord, 'string' | 'number'> = {
    title: 'string',
    price: 'number',
    storyAndPostDetails: 'string',
};

export const UPDATE_OFFER_FIELD_SERVICE = Symbol('UPDATE_OFFER_FIELD_SERVICE');

@Injectable()
export class UpdateOfferFieldService {
    private readonly logger = new FilteredNestLogger(UpdateOfferFieldService.name);

    constructor(
        private readonly offerRepository: OfferRepository,
        private readonly offerAccountLinkRepository: OfferAccountLinkRepository,
        @Inject(CREATE_OFFER_SERVICE)
        private readonly createOfferService: CreateOfferService,
    ) { }

    async exec(offerId: ObjId, payload: UpdateOfferFieldDto): Promise<void> {
        const session = await this.offerRepository.startSession();
        session.startTransaction();

        try {
            // Finds offer
            const originalOfferWithFollowers = await this.offerRepository.findOfferAndCountFollowers(offerId, session);

            if (!originalOfferWithFollowers || !originalOfferWithFollowers.offer) {
                throw new NotFoundException('Requested offer not found');
            }

            const {offer: originalOffer, combinedFollowers} = originalOfferWithFollowers;

            this.logger.debug(`OFFER INFO: ${JSON.stringify(originalOffer, null, '\t')}`);

            // Field that should be updated
            const field = this.processOfferFieldValue(payload as UpdateOfferFieldDto);

            this.logger.debug(`UPDATE OFFER FIELD INFO: ${JSON.stringify({
                isOriginalPublished: originalOffer.isPublished,
                fieldToUpdate: field,
                valueToSet: payload.value
            }, null, '\t')}`);


            // If offer published, creates a working copy
            // Otherwise, updates existing offer
            if (originalOffer.isPublished === true) {
                const offerWorkingCopyId = new ObjId();

                // Creating offer's working copy
                const offerWorkingCopy = await this.createOfferService.exec({
                    requestedId: offerWorkingCopyId,
                    offerName: field === 'title' ? payload.value as string : originalOffer.title,
                    socialMedia: originalOffer.socialMedia,
                    price: field === 'price' ? payload.value as number : originalOffer.price,
                    genre: originalOffer.genre,
                    combinedFollowers: combinedFollowers,
                    networksAmount: originalOffer.networksAmount.toString(),
                    storyAndPostDetails: field === 'storyAndPostDetails' ? payload.value as string : originalOffer.storyAndPostDetails,
                    referenceId: offerId,
                } satisfies AdminCreateOfferDto);

                if (!offerWorkingCopy) {
                    this.logger.warn(`
            Offer wasn't copied, while updating field '${payload.field}' in offer ${offerId}. 
            \nCreate offer working copy info: type ${typeof offerWorkingCopy}, value ${JSON.stringify(offerWorkingCopy, null, '\t')}.
          `);
                    throw new InternalServerErrorException('Something went wrong');
                }

                // Copying offer's accounts links
                const insertLinksResult = await this.offerAccountLinkRepository.copyLinksToOffer(offerId, offerWorkingCopyId, session);

                if (!Number.isFinite(insertLinksResult) || insertLinksResult <= 0) {
                    this.logger.warn(`
            Offer account links weren't copied, while updating field '${payload.field}' in offer ${offerId}.  
            \nInsert result info: type ${typeof insertLinksResult}, value ${insertLinksResult ?? 'undefined'}.
          `);
                    throw new InternalServerErrorException('Something went wrong');
                }
            } else {
                // If offer not published, that means that admin's updating the working copy or this offer was never published 
                // In any case, we don't need to create a copy for now.

                // $set object for updating existing offer, in case when it's not published
                let setPayload: UpdateQuery<Offer>['$set'] = {};

                const field = this.processOfferFieldValue(payload as UpdateOfferFieldDto);

                setPayload[field] = (payload as UpdateOfferFieldDto).value;

                const updateFieldResult = await this.updateExisting(
                    offerId,
                    setPayload,
                    session
                );

                if (!updateFieldResult) {
                    this.logger.error(`
                    UpdateOfferService.updateExisting returned null, while trying to update offer ${offerId} with payload: ${JSON.stringify(payload, null, '\t')}
                `);
                    throw new InternalServerErrorException(`Something went wrong.`);
                }
                if (updateFieldResult.matchedCount === 0) {
                    this.logger.error(`
                    UpdateOfferService.updateExisting returned matchedCount equal to 0, while trying to update offer ${offerId} with payload: ${JSON.stringify(payload, null, '\t')}
                `);
                    throw new InternalServerErrorException(`Something went wrong.`);
                }
                if (updateFieldResult.modifiedCount === 0) {
                    this.logger.error(`
                    UpdateOfferService.updateExisting returned modifiedCount equal to 0, while trying to update offer ${offerId} with payload: ${JSON.stringify(payload, null, '\t')}
                `);
                    throw new InternalServerErrorException(`Something went wrong.`);
                }
            }

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            await session.endSession();
        }
    }

    private processOfferFieldValue(
        payload: UpdateOfferFieldDto,
    ): keyof OfferFieldRecord {
        const { field, value } = payload

        const allowedFields: (keyof OfferFieldRecord)[] = [
            'title',
            'price',
            'storyAndPostDetails',
        ];

        if (!allowedFields.includes(payload.field as keyof OfferFieldRecord)) {
            throw new BadRequestException('Invalid offer field');
        }

        const validatedField = payload.field as keyof OfferFieldRecord;

        if (typeof value !== offerFieldTypes[validatedField]) {
            throw new BadRequestException(`Invalid value type for field "${field}"`);
        }

        return validatedField;
    }

    private async updateExisting(
        offerId: ObjId,
        setPayload: object,
        session?: ClientSession
    ): Promise<{ matchedCount: number, modifiedCount: number } | null> {
        const updateResult = await this.offerRepository.updateOne(
            { _id: offerId },
            setPayload,
            { session }
        );

        return { matchedCount: updateResult.matchedCount, modifiedCount: updateResult.modifiedCount };
    }
}